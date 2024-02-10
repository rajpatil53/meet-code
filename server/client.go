package main

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

type Client struct {
	id   string
	room *Room
	conn *websocket.Conn
}

func (client *Client) readStream() {
	defer func() {
		client.room.unregister <- client
		client.conn.Close()
	}()
	for {
		_, messageData, err := client.conn.ReadMessage()
		if err != nil {
			log.Println(err)
			break
		}
		message := Message{From: client.id}
		json.Unmarshal(messageData, &message)
		client.room.broadcast <- message
	}
}
