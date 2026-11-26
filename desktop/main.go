package main

import (
	"embed"
	"log"
	"os"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/dotkext/dot-expenses/desktop/internal/api"
	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	db, err := store.Open()
	if err != nil {
		log.Fatal(err)
	}
	service := api.NewService(db)

	var browserArgs []string
	if os.Getenv("DOT_DEBUG") == "1" {
		browserArgs = []string{"--remote-debugging-port=9222"}
	}

	app := application.New(application.Options{
		Name:        "dot-expenses",
		Description: "Local-first expense and budget tracker",
		Services: []application.Service{
			application.NewService(service),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Windows: application.WindowsOptions{
			AdditionalBrowserArgs: browserArgs,
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "dot-expenses",
		Width:            1200,
		Height:           800,
		MinWidth:         940,
		MinHeight:        620,
		Frameless:        true,
		BackgroundType:   application.BackgroundTypeSolid,
		BackgroundColour: application.NewRGB(10, 10, 12),
		URL:              "/",
		Mac: application.MacWindow{
			TitleBar:   application.MacTitleBarHidden,
			CornerType: application.MacWindowCornerTypeRounded,
			Backdrop:   application.MacBackdropNormal,
		},
	})
	_ = win

	// Catch up on recurring rules and refresh exchange rates in the background.
	go func() {
		_ = service.RunDueRecurring()
		_, _ = service.RefreshRates()
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			_ = service.RunDueRecurring()
		}
	}()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
