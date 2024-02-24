package main

import (
	"encoding/json"
	"log"
	"slices"
	"strconv"
	"time"
)

type Room struct {
	Id         string `json:"id"`
	clients    []*Client
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
}

func (r *Room) MarshalJSON() ([]byte, error) {
	memberCount := len(r.clients)
	return json.Marshal(map[string]string{
		"id":          r.Id,
		"memberCount": strconv.Itoa(memberCount),
	})
}

func (r *Room) start() {
	log.Println("Starting: ", r)
	// Close the room if no one joins it in 5 mins
	timer := time.NewTimer(time.Minute * 5)
	defer func() {
		rooms = slices.DeleteFunc(rooms, func(room *Room) bool { return r == room })
	}()
	for {
		select {
		case <-timer.C:
			return
		case client := <-r.register:
			timer.Stop()
			r.clients = append(r.clients, client)
		case client := <-r.unregister:
			r.clients = slices.DeleteFunc(r.clients, func(c *Client) bool { return c == client })
			if len(r.clients) == 0 {
				timer.Reset(time.Minute * 5)
			}
			for _, c := range r.clients {
				message := Message{Type: RemovePeer, Data: client.id}
				c.conn.WriteJSON(message)
				// select {
				// case client.send <- message:
				// default:
				// 	close(client.send)
				// 	delete(r.clients, client)
				// }
			}
		case message := <-r.broadcast:
			switch message.Type {
			case Join:
				if len(r.clients) > 1 {
					index := r.indexOfClient(message.From)
					for _, client := range r.clients[:index] {
						message := Message{Type: CreateOffer, From: message.From}
						client.conn.WriteJSON(message)
					}
				}
			case Offer:
				client := r.getClient(message.To)
				message := Message{Type: SetOffer, Data: message.Data, From: message.From}
				client.conn.WriteJSON(message)
			case Answer:
				client := r.getClient(message.To)
				message := Message{Type: SetAnswer, Data: message.Data, From: message.From}
				client.conn.WriteJSON(message)
			case NewIceCandidate:
				for _, client := range r.clients {
					if client.id == message.From {
						continue
					}
					message := Message{Type: AddIceCandidate, Data: message.Data, From: message.From}
					client.conn.WriteJSON(message)
				}
			}
		}
	}
}

func (r *Room) indexOfClient(clientId string) int {
	return slices.IndexFunc(r.clients, func(c *Client) bool { return c.id == clientId })
}

func (r *Room) getClient(clientId string) *Client {
	clientIndex := r.indexOfClient(clientId)
	return r.clients[clientIndex]
}

var rooms []*Room = []*Room{}
