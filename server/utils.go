package main

import (
	"crypto/rand"
	"encoding/base64"
)

func generateId(len int) string {
	buff := make([]byte, len)
	_, err := rand.Read(buff)
	if err != nil {
		panic(err)
	}
	str := base64.URLEncoding.EncodeToString(buff)
	// Base 64 can be longer than len
	return str[:len]
}
