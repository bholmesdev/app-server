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

	// Process configuration
	config := loadConfig()
	if config.Timeout == nil {
		defaultTimeout := 30
		config.Timeout = &defaultTimeout
		log.Println("Warning: no timeout configured, using default of 30 seconds")
	}
	log.Printf("Starting with timeout: %d seconds", *config.Timeout)
}

type Config struct {
	Timeout *int
	Retries int
}

func loadConfig() *Config {
	// TODO: load from environment or config file
	timeout := 30
	return &Config{
		Timeout: &timeout,
		Retries: 3,
	}
}
