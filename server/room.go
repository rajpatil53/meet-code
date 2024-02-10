package main

import (
	"log"
	"slices"
)

type Room struct {
	Id         string `json:"id"`
	clients    []*Client
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
}

func (r *Room) start() {
	log.Println("Starting: ", r)
	defer func() {
		close(r.broadcast)
		close(r.register)
		close(r.unregister)
	}()
	for {
		select {
		case client := <-r.register:
			r.clients = append(r.clients, client)
		case client := <-r.unregister:
			slices.DeleteFunc(r.clients, func(c *Client) bool { return c == client })
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
					index := r.indexOf(message.From)
					for _, client := range r.clients[:index] {
						message := Message{Type: CreateOffer, From: message.From}
						client.conn.WriteJSON(message)
					}
				}
			case Offer:
				index := r.indexOf(message.To)
				client := r.clients[index]
				message := Message{Type: SetOffer, Data: message.Data, From: message.From}
				client.conn.WriteJSON(message)
			case Answer:
				index := r.indexOf(message.To)
				client := r.clients[index]
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

func (r *Room) indexOf(clientId string) int {
	return slices.IndexFunc(r.clients, func(c *Client) bool { return c.id == clientId })
}

var rooms []*Room = []*Room{}
