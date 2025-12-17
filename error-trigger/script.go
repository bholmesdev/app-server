package main

import (
	"log"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

func main() {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		log.Fatal("SENTRY_DSN environment variable is required")
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn: dsn,
	})
	if err != nil {
		log.Fatalf("sentry.Init: %s", err)
	}
	defer sentry.Flush(2 * time.Second)

	defer sentry.Recover()

	var p *int
	_ = *p // nil pointer dereference
}
