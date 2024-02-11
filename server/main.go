package main

import (
	"encoding/json"
	"log"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type MessageType string

const (
	// From client:
	Join            MessageType = "Join"
	Offer           MessageType = "Offer"
	Answer          MessageType = "Answer"
	NewIceCandidate MessageType = "NewIceCandidate"
	// From server
	ClientId        MessageType = "ClientId"
	CreateOffer     MessageType = "CreateOffer"
	SetOffer        MessageType = "SetOffer"
	SetAnswer       MessageType = "SetAnswer"
	AddIceCandidate MessageType = "AddIceCandidate"
	RemovePeer      MessageType = "RemovePeer"
	RoomClosed      MessageType = "RoomClosed"
)

var allowedOrigins = []string{
	"http://localhost:3000",
	"https://meet-code-rajpatil53.vercel.app",
}

type Message struct {
	Type MessageType `json:"type"`
	Data string      `json:"data"`
	From string      `json:"from"`
	To   string      `json:"to"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return false
		}
		for _, allowedOrigin := range allowedOrigins {
			if strings.HasPrefix(origin, allowedOrigin) {
				return true
			}
		}
		return false
	},
}

func createRoom(c *gin.Context) {
	newRoom := Room{
		Id:         generateId(6),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    []*Client{},
		// Offer: offer,
	}
	rooms = append(rooms, &newRoom)
	go newRoom.start()
	json.NewEncoder(c.Writer).Encode(newRoom)
}

func listRooms(c *gin.Context) {
	json.NewEncoder(c.Writer).Encode(rooms)
}

func handleRoom(c *gin.Context) {

	id := c.Param("id")
	roomIndex := slices.IndexFunc(rooms, func(room *Room) bool { return room.Id == id })
	if roomIndex == -1 {
		return
	}
	room := rooms[roomIndex]
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := Client{id: generateId(12), room: room, conn: conn}
	room.register <- &client

	go client.readStream()
}

func main() {
	router := gin.Default()
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = allowedOrigins
	router.Use(cors.New(corsConfig))

	router.POST("/rooms", createRoom)
	router.GET("/rooms", listRooms)
	router.GET("/rooms/:id", handleRoom)

	router.Run()
}
