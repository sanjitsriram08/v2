app.use((req, res, next) => {
    const { method, url, headers, query, params, body } = req;

    // Log incoming request type
    logger.info(`Incoming Request: ${method} ${url}`);
    logger.info(`Headers: ${JSON.stringify(headers)}`);

    // Determine and log request types
    if (Object.keys(query).length > 0) {
        logger.info(`Query Parameters: ${JSON.stringify(query)}`);
    }
    if (Object.keys(params).length > 0) {
        logger.info(`Route Parameters: ${JSON.stringify(params)}`);
    }
    if (Object.keys(body).length > 0) {
        logger.info(`Body: ${JSON.stringify(body)}`);
    }

    // Intercept the response send method to log response details
    const originalSend = res.send;
    res.send = (body) => {
        logger.info(`Response Status: ${res.statusCode}`);
        logger.info(`Response Body: ${body}`);
        originalSend.call(res, body);
    };

    next();
});

// Request Details – Method (GET/POST), URL, headers, query params, route params, and body.
// Response Details – Status code and response body before sending it.