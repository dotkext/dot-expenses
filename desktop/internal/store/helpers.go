package store

import (
	"crypto/rand"
	"fmt"
	"time"
)

func NewID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func Now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func Today() string {
	return time.Now().Format("2006-01-02")
}

func CurrentMonth() string {
	return time.Now().Format("2006-01")
}
