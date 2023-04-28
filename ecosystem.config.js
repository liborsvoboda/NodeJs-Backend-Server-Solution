module.exports = {
    apps: [
        {
            name: "API",
            cwd: "/home/saaspixel/",
            script: "./api_server.js",
            watch: ["./api_server.js"],
            env: {
                "NODE_ENV": "development",
            },
            env_production: {
                "NODE_ENV": "production"
            }
        },
        {
            name: "WebSockets",
            cwd: "/home/saaspixel/",
            script: "./ws_server.js",
            watch: ["./ws_server.js"],
            env: {
                "NODE_ENV": "development",
            },
            env_production: {
                "NODE_ENV": "production"
            }
        },
        {
            name: "Cron_AND_realtime_MySQL",
            cwd: "/home/saaspixel/",
            script: "./cron_realtime_mysql.js",
            watch: ["./cron_realtime_mysql.js"],
            cron_restart: "10 0-23/1 * * *",
            env: {
                "NODE_ENV": "development",
            },
            env_production: {
                "NODE_ENV": "production"
            }
        }
    ]
}

