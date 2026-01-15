module.exports = {
    apps: [{
        name: "streamverse",
        script: "./server.js",
        watch: false,
        env: {
            NODE_ENV: "production",
        },
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
}
