
let clients = [];

function setupSSE(req, res) {
    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache"
    };
    res.writeHead(200, headers);

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    console.log(`New SSE client connected: ${clientId}`);

    req.on("close", () => {
        console.log(`SSE client disconnected: ${clientId}`);
        clients = clients.filter(c => c.id !== clientId);
    });
}

function sendEvent(type, data) {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    });
}

module.exports = {
    setupSSE,
    sendEvent
};
