const express = require("express");
require('dotenv').config();
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const auth = require("./middleware/auth");
const fcm = require("./controllers/push-notifications.controller");
const path = require("path");
const { encrypt, decrypt } = require("./controllers/CryptUtils");
const stripe = require("stripe")(process.env.SECRET_KEY);
const PORT = process.env.PORT || 3000;
const { sq } = require("./config/dbconfig");
const { Op } = require("sequelize");
const moment = require('moment');
const crypto = require('crypto');
const {
    User,
    UserLog,
    Payment,
    Client,
    Message,
    MessageReceiver,
    Enquiry,
    Ad, AdsFrequency, News, Plan
} = require("./models/model");
const sendEmail = require('./utils/sendEmail');
const { encodePermissions } = require('./utils/authUtil');
const randomString = require('randomstring');
const { readdir, readFile, readFileSync } = require("node:fs");
const { render } = require('ejs');
const { hasAccess } = require('./utils/authUtil');
const logger = require('./middleware/logger');

function generateHash(text, secret) {
    return crypto.createHmac('sha256', secret).update(text).digest('hex');
}

// Generate OTP
function generateOTP() {
    return randomString.generate({
        length: 6,
        charset: 'numeric'
    });
}

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});

app.use(express.static(path.join(__dirname, 'web')));

//for Stripe webhooks
app.use(
    express.json({
        verify: function (req, res, buf) {
            if (req.originalUrl.startsWith("/webhook")) {
                req.rawBody = buf.toString();
            }
        },
    })
);
app.use(express.urlencoded({ extended: false }));
app.set("views", path.join("./webview"));
app.set("view engine", "ejs");
app.use(cors());
app.use((req, res, next) => {
    const { method, url, headers, body } = req;

    // Log incoming request
    logger.info(`Incoming Request: ${method} ${url}`);
    logger.info(`Headers: ${JSON.stringify(headers)}`);
    logger.info(`Body: ${JSON.stringify(body)}`);

    // Intercept the response send method to log response details
    const originalSend = res.send;
    res.send = (body) => {
        // Log the response
        logger.info(`Response Status: ${res.statusCode}`);
        logger.info(`Response Body: ${body}`);

        // Call the original send method
        originalSend.call(res, body);
    };

    next();
});

const parseDate = (dob) => {
    const [day, month, year] = dob.split('-');
    return new Date(`${year}-${month}-${day}`);
};

// getting user data
app.get(`/api/${encodePermissions(true, true, true)}/data`, auth, async (req, res) => {
    try {
        if (req.type === "2") {
            return res.status(200).send({
                "type": "2",
            });
        }
        await sq.transaction(async (t) => {
            const user = await User.findOne({
                where: { id: req.id },
                attributes: { exclude: ['password'] },
                include: [
                    {
                        model: UserLog,
                        as: 'user_log', // Alias for UserLog
                        required: false, // Allow UserLog to be null
                        attributes: [
                            'start_date', // Alias for start_date
                            'end_date', // Alias for end_date
                            'plan', // Include plan as-is
                        ],
                        include: [
                            {
                                model: Payment, // Include Payment model
                                as: 'payment', // Alias for Payment
                                required: false, // Allow Payment to be null
                                attributes: [
                                    'payment_date', // Alias for payment_date
                                    'end_date', // Alias for Payment end_date
                                ],
                            },
                        ],
                    },
                ],
            });

            const plans = await Plan.findAll({ order: [["plan_name"]] });

            const news = await News.findAll({
                order: [['id', 'DESC']], // Order by `id` in descending order
                limit: 5, // Limit the results to 5 rows
            });

            return res.status(200).send({ ...user.toJSON(), plans, news });
        });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.sendStatus(500);
    }
});

// LOGIN (USERS AND ADMIN)
app.post(`/api/${encodePermissions(false, false, false)}/login`, async (req, res) => {
    let { email, password, fcmtoken, platform } = req.body;

    try {
        if (email == process.env.SUPERADMIN_EMAIL && password == process.env.SUPERADMIN_PASSWORD) {
            return res.status(200).send({
                "type": "2",
                "token": jwt.sign({ email: email, password: password, type: "2" }, "passwordKey")
            });
        }
        // Retrieve user along with associated UserLog and Payment data
        await sq.transaction(async (t) => {
            const user = await User.findOne({
                where: { email: email },
                include: [
                    {
                        model: UserLog,
                        as: 'user_log', // Alias for UserLog
                        required: false, // Allow UserLog to be null
                        attributes: [
                            'start_date', // Alias for start_date 
                            'end_date', // Alias for end_date
                            'plan', // Include plan as-is
                        ],
                        include: [
                            {
                                model: Payment, // Include Payment model
                                as: 'payment', // Alias for Payment
                                required: false, // Allow Payment to be null
                                attributes: [

                                    'payment_date', // Alias for payment_date

                                    'end_date', // Alias for Payment end_date

                                ],
                            },
                        ],
                    },
                ],
            });

            if (!user) {
                return res.status(400).json({ message: "Email is not registered" });
            }

            // Compare the provided password with the stored hashed password
            const isMatch = password === decrypt(user.password);

            if (!isMatch) {
                return res.status(400).json({ code: 1003, message: "Incorrect Password" });
            }

            const plans = await Plan.findAll({ order: [["plan_name"]] });

            const news = await News.findAll({
                order: [['id', 'DESC']], // Order by `id` in descending order
                limit: 5, // Limit the results to 5 rows
            });

            const token = jwt.sign({ id: user.id }, "passwordKey");

            if (user.type === "1" || user.type === "0") {
                await Client.findOrCreate({
                    where: { fcmtoken: fcmtoken },
                    defaults: { user_id: user.id, platform: platform },
                    transaction: t,
                });
            } else if (user.type === "-1") {
                return res.status(200).send({ "type": user.type })
            }
            return res.status(200).send({ ...user.toJSON(), token, plans, news });
        });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error(e.message);
        return res.sendStatus(500);
    }
});

//Profile update
app.put(`/api/${encodePermissions(false, true, true)}/profile`, auth, async (req, res) => {
    let { fname, lname, dob, phone, email, country, state, city } = req.body;
    try {
        const user = await User.findOne({
            where: { id: req.id },
            attributes: [
                "id",
                "fname",
                "lname",
                "email",
                "stripe_id"
            ]
        });
        const [affectedRows, updatedUser] = await User.update(
            {
                fname: fname,
                lname: lname,
                dob: parseDate(dob), // Convert DD-MM-YYYY to YYYY-MM-DD
                phone: phone,
                email: email,
                country: country,
                state: state,
                city: city,
            },
            {
                where: { id: req.id },
                returning: true
            }
        );

        if (user.stripe_id != null && (user.fname != updatedUser[0].fname || user.lname != updatedUser[0].lname || user.email != updatedUser[0].email)) {
            console.log("Updating Stripe Records");
            const updatedCustomer = await stripe.customers.update(user.stripe_id, {
                name: updatedUser[0].fname + " " + updatedUser[0].lname,
                email: updatedUser[0].email
            });
            console.log('Customer updated successfully');
        }

        if (affectedRows === 0) {
            console.log("Profile Not Updated");
            return res.status(400).json({ message: "Profile Not Updated" });
        } else {
            console.log("Profile Updated");
            return res.status(200).json({ message: "Profile Updated" });
        }
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error(e.message);
        return res.sendStatus(500);
    }
});

//user registration
app.post(`/api/${encodePermissions(false, false, false)}/register`, async (req, res) => {
    let { fname, lname, dob, phone, email, country, password, isJapanese } = req.body;
    let hashedpwd = encrypt(password);
    try {
        // Check if the user with the given email already exists
        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(400).json({ code: 1001, message: "Email already exists" });
        }

        // Create a new user and log the registration
        await sq.transaction(async (t) => {
            // Create a new user
            const newUser = await User.create(
                {
                    fname: fname,
                    lname: lname,
                    dob: dob !== "" ? parseDate(dob) : null, // Convert string to Date object
                    phone: phone,
                    email: email,
                    country: country,
                    password: hashedpwd,
                    type: "0",
                    is_japanese: isJapanese
                },
                { transaction: t }
            ); // Pass the transaction to User.create

            // Create a new user log entry
            await UserLog.create({ user_id: newUser.id }, { transaction: t }); // Pass the transaction to UserLog.create
        });

        console.log("User registered");
        return res.status(200).json({ message: "User registered" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error registering user:", e);
        return res.sendStatus(500);
    }
});

//admin registration
app.post(`/api/${encodePermissions(true, false, false)}/admins/register`, async (req, res) => {
    let { fname, lname, dob, phone, email, country, password, isJapanese } = req.body;
    let hashedpwd = encrypt(password);
    try {
        // Check if the user with the given email already exists
        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Create a new user and log the registration
        await sq.transaction(async (t) => {
            // Create a new user
            const newUser = await User.create(
                {
                    fname: fname,
                    lname: lname,
                    dob: dob !== "" ? parseDate(dob) : null, // Convert string to Date object
                    phone: phone,
                    email: email,
                    country: country,
                    password: hashedpwd,
                    type: "-1",
                    is_japanese: isJapanese
                },
                { transaction: t }
            ); // Pass the transaction to User.create

            // Create a new user log entry
            await UserLog.create({ user_id: newUser.id }, { transaction: t }); // Pass the transaction to UserLog.create
        });

        console.log("Admin registered");
        return res.status(200).json({ message: "Admin registered" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error registering user:", e);
        return res.sendStatus(500);
    }
});

// fetching messages
app.get(`/api/${encodePermissions(false, true, true)}/messages`, auth, async (req, res) => {
    const id = req.id;

    try {
        const messages = await Message.findAll({
            attributes: ["title2", "number2", "message2",
                [
                    sq.col('timestamp_column'),
                    "mins",
                ]
            ],
            include: [
                {
                    model: MessageReceiver,
                    as: "receiver",
                    where: {
                        receiver_id: id,
                    },
                },
            ],
            order: [["timestamp_column", "DESC"]],
        });
        console.log("Messages fetched");
        return res.status(200).json(messages);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.status(500).json({ error: e.message });
    }
});

// fetching latest messages
app.get(`/api/${encodePermissions(false, true, true)}/messages/latest`, auth, async (req, res) => {
    const id = req.id;

    try {
        const messages = await Message.findAll({
            attributes: ["title2", "number2", "message2",
                [
                    sq.col("timestamp_column"),
                    "mins",
                ],
            ],
            include: [
                {
                    model: MessageReceiver,
                    as: "receiver",
                    where: {
                        receiver_id: id,
                    },
                },
            ],
            where: {
                timestamp_column: {
                    [Op.gte]: sq.literal(`(CURRENT_TIMESTAMP - INTERVAL '24 hours')`),
                },
            },
            order: [["timestamp_column", "DESC"]],
        });

        if (messages.length >= 1) {
            console.log("Messages fetched");
            return res.status(200).json(messages);
        }
        return res.sendStatus(400);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.status(500).json({ error: e.message });
    }
});

//News fetch
app.get(`/api/${encodePermissions(false, true, true)}/news`, auth, async (req, res) => {
    try {
        const news = await News.findAll({
            order: [['id', 'DESC']], // Order by `id` in descending order
        });
        console.log("news fetched");
        return res.status(200).json(news); // Return the fetched rows
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.status(500).json({ error: e.message }); // Handle errors
    }
});

//latest news fetch
app.get(`/api/${encodePermissions(false, true, true)}/news/latest`, auth, async (req, res) => {
    try {
        const news = await News.findAll({
            order: [['id', 'DESC']], // Order by `id` in descending order
            limit: 5, // Limit the results to 5 rows
        });
        console.log("news fetched");
        return res.status(200).json(news.length > 0 ? news : null);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.status(500).json({ error: e.message });
    }
});

//Ads fetch
app.get(`/api/${encodePermissions(false, true, true)}/ads`, async (req, res) => {
    try {
        const ads = await Ad.findAll();
        const frequency = await AdsFrequency.findOne({ where: { id: 1 } });
        res.status(200).send({ ads: ads, frequency: frequency.frequency });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error getting ads:", e);
        return res.sendStatus(500);
    }
});

//clear FCM token
app.delete(`/api/${encodePermissions(false, true, true)}/FCMToken/:fcmToken`, auth, async (req, res) => {
    try {
        // Delete the client record using Sequelize
        await Client.destroy({
            where: {
                fcmtoken: req.params.fcmToken || "", // Use req.body.fcmtoken if it exists, otherwise use an empty string
            },
        });
        return res.status(200).json(true); // Send success response if deletion is successful
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error({ error: e.message });
        return res.sendStatus(500); // Send error response if an exception occurs
    }
});

//sending push notifications
app.post(`/api/${encodePermissions(false, true, false)}/message`, auth, async (req, res) => {
    const sender = fcm();
    const {id, title2, number2, message2} = req.body;
    console.log({id, title2, number2, message2});
    try {
        const sql = `
            WITH inserted_message AS (
                INSERT INTO messages(sender, title2, number2, message2)
                VALUES(:sender, :title2, :number2, :message2)
                RETURNING id, timestamp_column
            ),
            inserted_receivers AS (
                INSERT INTO message_receiver(message_id, receiver_id)
                SELECT DISTINCT im.id, u.id
                FROM inserted_message im
                CROSS JOIN users u
                LEFT OUTER JOIN user_log ul ON u.id = ul.user_id
                WHERE
                    (u.type = '0'
                    AND ul.end_date >= ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC') * 1000)::BIGINT)
                    AND ul.start_date <= ((EXTRACT(EPOCH FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC') * 1000)::BIGINT)
                    AND (
                        (ul.plan IN (
                            SELECT monthly_price_id FROM plans WHERE session = '0'
                            UNION ALL
                            SELECT yearly_price_id FROM plans WHERE session = '0'
                        ) AND
                        CURRENT_TIME AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' BETWEEN TIME '06:00' AND TIME '15:30')
                        OR
                        (ul.plan IN (
                            SELECT monthly_price_id FROM plans WHERE session = '1'
                            UNION ALL
                            SELECT yearly_price_id FROM plans WHERE session = '1'
                        ) AND
                        (CURRENT_TIME AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' >= TIME '16:00' OR CURRENT_TIME  AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' <= TIME '06:00'))
                        OR
                        (ul.plan IN (
                            SELECT monthly_price_id FROM plans WHERE session = '2'
                            UNION ALL
                            SELECT yearly_price_id FROM plans WHERE session = '2'
                        ) AND
                        (CURRENT_TIME AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' BETWEEN TIME '06:00' AND TIME '15:30' OR CURRENT_TIME  AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' >= TIME '16:00' OR CURRENT_TIME  AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' <= TIME '06:00'))
                        OR
                        ul.plan IS NULL
                    ))
                    OR
                    (u.type = '1')
            )
            SELECT im.id, im.timestamp_column FROM inserted_message im;
            `;
        const [results] = await sq.query(sql, {
            replacements: { sender: id, title2: title2, number2: number2, message2: message2 },
        });

        if (!results.length) {
            return res.status(500).json({ error: "Failed to insert message" });
        }

        const message_id = results[0].id;
        const timestamp_column = results[0].timestamp_column;

        // Fetch FCM tokens
        const fcmTokensQuery = `
            SELECT DISTINCT c.fcmtoken
            FROM message_receiver mr
            JOIN clients c ON c.user_id = mr.receiver_id
            WHERE mr.message_id = :message_id;
        `;

        const tokenResults = await sq.query(fcmTokensQuery, {
            replacements: { message_id: message_id },
            type: sq.QueryTypes.SELECT
        });

        if (tokenResults.length > 0) {
            const data = {
                timestamp: timestamp_column,
                title2: title2,
                number2: number2,
                msg2: message2
            };

            for (const row of tokenResults) {
                const send_message = {
                    message: {
                        token: row.fcmtoken,
                        notification: {
                            body: "Click to view",
                            title: "New Message",
                        },
                        data: data,
                        android: {
                            notification: {
                                channel_id: "nikoniko",
                            },
                        },
                    },
                };
                try {
                    await sender.getAccessToken().then(async () => {
                        await sender.sendMessage(send_message);
                    });
                } catch (e) {
                    logger.error(`Error sending FCM: ${e.message}`);
                    logger.error(`Stack: ${e.stack}`);
                    return res.status(500).json({ error: e.message });
                }
            }

            console.log("Messages sent");
        }

        return res.status(200).json({ message: "Messages Sent" });
    } catch (err) {
        logger.error(`Error occurred: ${err.message}`);
        logger.error(`Stack: ${err.stack}`);
        return res.status(500).json({ error: err.message });
    }
});

//update frequency
app.put(`/api/${encodePermissions(false, true, false)}/frequency/:newFrequency`, auth, async (req, res) => {
    try {
        const updated = await AdsFrequency.update(
            { frequency: Number(req.params.newFrequency) }, // Data to update
            { where: { id: 1 } } // Condition to match
        );

        if (updated[0] > 0) {
            // Sequelize `update` returns an array: [number_of_affected_rows, ...]
            return res.status(200).json({ message: "Frequency updated" });
        } else {
            return res.status(400).json({ error: "Frequency not found or unchanged" });
        }
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error updating frequency:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

//News Creation
app.post(`/api/${encodePermissions(false, true, false)}/news`, auth, async (req, res) => {
    let {
        title,
        description,
    } = req.body;

    try {
        const news = await News.create({
            title: title, // Replace with the actual variable holding the title
            description: description, // Replace with the actual variable holding the description
        });

        console.log("News added");
        return res.status(200).json({ message: "News added" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error adding news:", e.message);
        return res.status(500).json({ error: e.message });
    }
});

app.delete(`/api/${encodePermissions(false, true, false)}/news/:id`, auth, async (req, res) => {
    try {
        const deletedCount = await News.destroy({
            where: { id: req.params.id }
        });

        if (deletedCount === 0) {
            return res.status(404).json({ error: "News not found" });
        }

        console.log("News deleted");
        return res.status(200).json({ message: "News deleted" });
    } catch (err) {
        logger.error(`Error occurred: ${err.message}`);
        logger.error(`Stack: ${err.stack}`);
        return res.status(500).json({ error: err.message });
    }
});

//Ads Creation
app.post(`/api/${encodePermissions(false, true, false)}/ad`, auth, async (req, res) => {
    try {
        const { title, description, imageurl, redirecturl, bgcolor, titlecolor, descriptioncolor } = req.body;

        await Ad.create({
            title,
            description,
            imageurl,
            redirecturl,
            bgcolor,
            titlecolor,
            descriptioncolor
        });

        console.log("Ads added");
        return res.status(200).json({ message: "Ads added" });
    } catch (err) {
        logger.error(`Error occurred: ${err.message}`);
        logger.error(`Stack: ${err.stack}`);
        return res.status(500).json({ error: err.message });
    }
});

//delete Ad
app.delete(`/api/${encodePermissions(false, true, false)}/ad/:id`, auth, async (req, res) => {
    try {
        const deletedCount = await Ad.destroy({
            where: { id: req.params.id }
        });

        if (deletedCount === 0) {
            return res.status(404).json({ error: "Ad not found" });
        }

        console.log("Ad deleted");
        return res.status(200).json({ message: "Ad deleted" });
    } catch (err) {
        logger.error(`Error occurred: ${err.message}`);
        logger.error(`Stack: ${err.stack}`);
        return res.status(500).json({ error: err.message });
    }
});

//admins fetch
app.get(`/api/${encodePermissions(true, false, false)}/admins`, auth, async (req, res) => {
    try {
        const admins = await User.findAll({
            attributes: ["email", "password", "type"],
            where: {
                type: {
                    [Op.in]: ["1", "-1"], // Specify that type should be either 1 or -1
                },
            },
            order: [["id", "DESC"]],
        });
        console.log(admins);
        console.log("Fetched Admins");
        return res.status(200).json(admins);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
});

//users fetch
app.get(`/api/${encodePermissions(true, false, false)}/users`, auth, async (req, res) => {
    try {
        const users = await User.findAll({
            where: { type: "0" },
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: UserLog,
                    as: 'user_log', // Alias for UserLog
                    required: false, // Allow UserLog to be null
                    attributes: [
                        'start_date', // Alias for start_date
                        'end_date', // Alias for end_date
                        'plan', // Include plan as-is
                    ],
                    include: [
                        {
                            model: Payment, // Include Payment model
                            as: 'payment', // Alias for Payment
                            required: false, // Allow Payment to be null
                            attributes: [
                                'payment_date', // Alias for payment_date
                                'end_date', // Alias for Payment end_date
                            ],
                        },
                    ],
                },
            ],
        });

        res.status(200).send(users);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.sendStatus(500);
    }
});

//Admin activation toggle
app.put(`/api/${encodePermissions(true, false, false)}/admins/type`, auth, async (req, res) => {
    let { email, type } = req.body;

    try {
        // Update the user with the specified email
        const [affectedRows] = await User.update(
            { type: type }, // Values to update
            { where: { email: email } } // Condition for the update
        );

        if (affectedRows === 0) {
            console.log("No user found with the specified email");
            return res
                .status(404)
                .json({ message: "No user found with the specified email" });
        }

        console.log("Admin Activated");
        return res.status(200).json({ message: "Admin Activated" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        return res.sendStatus(500);
    }
});

//User updation
app.put(`/api/${encodePermissions(true, false, false)}/users`, auth, async (req, res) => {
    let { startDate, endDate, email } = req.body;

    try {
        // Find the user by email

        await sq.transaction(async (t) => {
            const user = await User.findOne({
                where: { email: email },
                transaction: t,
            });

            // Update the user log associated with the user
            const [affectedRows] = await UserLog.update(
                {
                    start_date: startDate,
                    end_date: endDate
                },
                {
                    where: {
                        user_id: user.id,
                    },
                    transaction: t,
                }
            );

            if (affectedRows === 0) {
                console.log("User log not found");
                return res.status(404).json({ message: "User log not found" });
            }

            console.log("User Activated");
            return res.status(200).json({ message: "User Activated" });
        });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        return res.sendStatus(500);
    }
});

//change password
app.put(`/api/${encodePermissions(false, false, false)}/users/password`, async (req, res) => {
    try {
        let {
            email,
            password
        } = req.body;
        const user = await User.findOne({ where: { email: email } });
        if (password === decrypt(user.password)) {
            return res.status(400).json({ message: "Old Password and New Password should not be same" });
        }
        const hashedPwd = encrypt(password);
        await User.update(
            { password: hashedPwd }, // Fields to update
            { where: { email: email } }          // Condition to match records
        );
        return res.status(200).json({ message: "Password changed" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        return res.status(500).json({ error: e.message });
    }
});

//send otp
app.post(`/api/${encodePermissions(false, false, false)}/otp`, async (req, res, next) => {
    try {
        const { email, isUser } = req.body;
        const user = await User.findOne({ where: { email: email } });
        if (isUser && !user) {
            return res.status(400).json({ code: 1002, message: "Email does not exist" });
        }
        if (!isUser && user) {
            return res.status(400).json({ code: 1001, message: "Email already exists" });
        }

        const otp = generateOTP();

        const templatePath = path.join(__dirname, 'support_files', 'html_files', 'otp_template.ejs');
        const htmlTemplate = readFileSync(templatePath, 'utf-8');
        const renderedHtml = render(htmlTemplate, { otp });

        // Send OTP via email
        await sendEmail({
            to: email,
            subject: 'Your OTP',
            message: renderedHtml,
        });

        res.status(200).json({ otp: generateHash((otp + email), (otp + email)), success: true, code: 2001, message: 'OTP sent successfully' });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error('Error sending OTP:', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
)

app.post(`/api/${encodePermissions(false, false, true)}/enquiry`, auth, async (req, res) => {
    try {
        const { id, name, email, message } = req.body;
        const user = await User.findOne({ where: { id: id } });
        const enquiry = await Enquiry.create({
            user_id: id,
            name: name,
            email: email,
            message: message,
            status: "pending"
        });

        let templatePath = path.join(__dirname, 'support_files', 'html_files', 'enquiry_user_template.ejs');
        let htmlTemplate = readFileSync(templatePath, 'utf-8');
        let renderedHtml = render(htmlTemplate, { enquiry });

        await sendEmail({
            to: user.email,
            subject: 'Confirmation of Your Support Request',
            message: renderedHtml
        })

        // Format the submission date to Tokyo time
        const formattedTime = moment(Number(enquiry.created_time))
            .format("DD-MM-YYYY hh:mm A");

        templatePath = path.join(__dirname, 'support_files', 'html_files', 'enquiry_admin_template.ejs');
        htmlTemplate = readFileSync(templatePath, 'utf-8');
        renderedHtml = render(htmlTemplate, { enquiry, formattedTime });

        await sendEmail({
            to: process.env.ADMIN_MAIL || 'appdev.krdx@gmail.com',
            subject: 'New Support Request ',
            message: renderedHtml
        });
        return res.status(200).json({ message: "Enquiry Submitted" });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error registering user:", e);
        return res.sendStatus(500);
    }

});

app.get(`/api/${encodePermissions(false, true, false)}/enquiry`, auth, async (req, res) => {
    try {
        const enquiries = await Enquiry.findAll({
            order: [['created_time', 'DESC']], // Sorts from newest to oldest
        });
        enquiries.forEach((e) => {
            e.dataValues['formatted_id'] = e.formatted_id;
        });
        res.status(200).send({ enquiries: enquiries });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error getting enquiries:", e);
        return res.sendStatus(500);
    }
});

app.put(`/api/${encodePermissions(false, true, false)}/enquiry/status/resolved/:id`, auth, async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`Received request to resolve enquiry with ID: ${id}`);

        // Find the enquiry by ID
        const enquiry = await Enquiry.findByPk(id);
        if (!enquiry) {
            console.error(`Enquiry with ID ${id} not found`);
            return res.status(404).json({ error: 'Enquiry not found' });
        }

        // Update the status to 'resolved'
        enquiry.status = 'resolved';
        enquiry.resolved_time = sq.literal("(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT");
        await enquiry.save();

        let templatePath = path.join(__dirname, 'support_files', 'html_files', 'enquiry_resolved_user_template.ejs');
        let htmlTemplate = readFileSync(templatePath, 'utf-8');
        let renderedHtml = render(htmlTemplate, { enquiry });

        await sendEmail({
            to: enquiry.email,
            subject: 'Your Support Request Has Been Resolved',
            message: renderedHtml
        });


        console.log(`Enquiry with ID ${id} marked as resolved`);
        return res.status(200).json({ message: 'Enquiry marked as resolved', enquiry });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error('Error resolving enquiry:', e);
        return res.status(500).json({ error: 'Failed to mark enquiry as resolved' });
    }
});

//fetch orders
app.get(`/api/${encodePermissions(false, false, true)}/orders`, auth, async (req, res) => {


    try {
        // Fetch user along with their user_log in a single query
        const userWithLog = await User.findOne({
            where: { id: req.id },
            attributes: ['id', 'stripe_id'], // Only select the user id and stripe_id
            include: [{
                model: UserLog,
                attributes: ['subscription_id', 'payment_id'], // Only select subscription_id and payment_id from user_log
                where: { user_id: req.id },
                required: true // Ensures the user_log is fetched with the user
            }]
        });

        if (!userWithLog || !userWithLog.user_log.payment_id) {
            console.log("No Orders found");
            return res.status(400).json({ success: false, message: 'User or user log not found' });
        }
        // Extract user and user_log details
        const user = userWithLog;
        const userLog = userWithLog.user_log; // Assuming there's only one user_log entry

        // Check if the subscription_id is available in the user_log
        let subscription_id = userLog.subscription_id;

        if (!subscription_id && userLog.payment_id) {
            // If subscription_id is not found, fetch subscription_id from payment_id (which is the invoice ID)
            const invoice = await stripe.invoices.retrieve(userLog.payment_id);

            // If the invoice was found and it has a subscription_id, update the user_log
            if (invoice.subscription) {
                subscription_id = invoice.subscription;

                // Update user_log with the retrieved subscription_id
                await UserLog.update({ subscription_id: subscription_id }, { where: { user_id: req.id } });
            } else {
                // If no subscription is associated with the invoice, handle accordingly
                return res.status(404).json({
                    success: false,
                    message: 'No subscription found for the provided payment ID'
                });
            }
        }

        // Fetch open and paid invoices filtered by the subscription_id
        const open_invoices = await stripe.invoices.list({
            customer: user.stripe_id,
            status: "open",
            subscription: subscription_id  // Filter by subscription_id
        });

        const paid_invoices = await stripe.invoices.list({
            customer: user.stripe_id,
            status: "paid",
            subscription: subscription_id  // Filter by subscription_id
        });

        // Combine the open and paid invoices
        const invoices = [...open_invoices.data, ...paid_invoices.data].sort(
            (a, b) => b.created - a.created // Sort by newest first
        );

        // Map the invoices to the desired structure
        const orders = invoices.map(order => ({
            plan_id: order.lines.data[0].plan.id,
            amount: order.amount_paid,
            status: order.status,
            currency: order.currency,
            created: order.created, // Timestamp
            stripeUrl: order.hosted_invoice_url,
            // Stripe dashboard link
        }));

        // Return the orders as a response
        res.json({ success: true, orders: orders });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        res.status(500).json({ success: false, error: e.message });
    }
});


app.put(`/api/${encodePermissions(false, true, true)}/language/:code`, auth, async (req, res) => {
    const lang_code = req.params.code;
    if (lang_code !== "en" && lang_code !== "ja") return res.status(400).json({ message: "Invalid Language Code" });
    try {
        const [affectedRows] = await User.update(
            {
                is_japanese: lang_code !== "en",
            },
            { where: { id: req.id } }
        );

        if (affectedRows === 0) {
            console.log("Language Not Updated");
            return res.status(400).json({ message: "Language Not Updated" });
        } else {
            console.log("Profile Updated");
            return res.status(200).json({ message: "Language Updated" });
        }
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error(e.message);
        return res.sendStatus(500);
    }
});

//Stripe webhook
app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
        let data;
        let eventType;
        const payloadString = JSON.stringify(req.body, null, 2);
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            let event;

            const secret = process.env.STRIPE_WEBHOOK_SECRET;
            const header = stripe.webhooks.generateTestHeaderString({
                payload: payloadString,
                secret,
            });

            try {
                event = stripe.webhooks.constructEvent(
                    payloadString,
                    header,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
            } catch (e) {
                logger.error(`Error occurred: ${e.message}`);
                logger.error(`Stack: ${e.stack}`);
                return res.sendStatus(400);
            }

            data = event.data;
            eventType = event.type;
        } else {
            data = req.body.data;
            eventType = req.body.type;
        }
        try {
            if (eventType === "invoice.payment_succeeded") {
                console.log(`🔔  Invoice Payment received!`);
                const customer_id = data.object.customer;
                const sub_id = data.object.subscription;
                const inv_id = data.object.id;
                const subscription = await stripe.subscriptions.retrieve(sub_id);
                const priceId = subscription.items.data[0].price.id;

                if (subscription.status === "active") {
                    console.log("Active subscription");
                    const startDate = subscription.current_period_start * 1000;
                    const endDate = subscription.current_period_end * 1000;
                    const transaction = await sq.transaction();
                    try {
                        // Insert into the payments table with ON CONFLICT DO NOTHING
                        const [payment, created] = await Payment.findOrCreate({
                            where: { id: inv_id },
                            defaults: {
                                id: inv_id,
                                user_id: sq.literal(
                                    `(SELECT id FROM users WHERE stripe_id = '${customer_id}')`
                                ),
                                payment_date: startDate,
                                end_date: endDate,
                            },
                            transaction,
                        });

                        // If no new payment was created, exit early
                        if (!created) {
                            console.log('Payment already exists, skipping insertion');
                        }

                        // Update the user_log table using the inserted payment data
                        const [affectedRows, updatedUserLog] = await UserLog.update(
                            {
                                payment_id: payment.id,
                                subscription_id: sub_id,
                                start_date: moment(startDate).startOf('day').valueOf(),
                                end_date: moment(endDate).endOf('day').valueOf(),
                                plan: priceId,
                            },
                            {
                                where: {
                                    user_id: {
                                        [Op.eq]: sq.literal(
                                            `(SELECT user_id FROM payments WHERE id = '${inv_id}')`
                                        ),
                                    }
                                },
                                transaction,
                                returning: true
                            }
                        );

                        const sender = fcm();
                        try {
                            // Step 1: Find the user_id from the stripe_id
                            const user = await User.findOne({
                                attributes: ['id'],
                                where: { stripe_id: customer_id }
                            });

                            if (!user) {
                                console.log({ message: "No user found with the given stripe_id" });
                                return res.status(404).json({ message: "No user found" });
                            }

                            // Step 2: Find distinct fcmtoken for the user_id
                            const clientTokens = await Client.findAll({
                                attributes: [[sq.fn('DISTINCT', sq.col('fcmtoken')), 'fcmtoken']],
                                where: { user_id: user.id }
                            });

                            if (clientTokens.length === 0) {
                                console.log({ message: "No active clients" });
                                // Commit the transaction
                                await transaction.commit();
                                console.log('Updated payments and user log successfully');
                                res.sendStatus(200);
                            }

                            // Step 3: Prepare and send FCM messages
                            const data = {
                                user_id: `${user.id}`,
                                plan: priceId,
                                payment_date: payment.payment_date,
                                payment_end_date: payment.end_date,
                                start_date: updatedUserLog[0].start_date,
                                end_date: updatedUserLog[0].end_date
                            };

                            for (const client of clientTokens) {
                                const send_message = {
                                    message: {
                                        token: client.fcmtoken,
                                        notification: {
                                            title: "🔔 Subscription Updated",
                                        },
                                        data: data,
                                        android: {
                                            priority: "high",
                                            notification: {
                                                channel_id: "nikoniko",
                                            },
                                        },
                                    },
                                };

                                try {
                                    await sender.getAccessToken().then(async () => {
                                        await sender.sendMessage(send_message);
                                    });
                                } catch (e) {
                                    logger.error(`Error occurred: ${e.message}`);
                                    logger.error(`Stack: ${e.stack}`);
                                    console.error(`Error for fcmtoken ${client.fcmtoken}: ${e.message}`);
                                    return res.status(500).json({ error: e.message });
                                }
                            }
                            // Commit the transaction
                            await transaction.commit();
                            console.log('Updated payments and user log successfully');
                            res.sendStatus(200);
                        } catch (e) {
                            logger.error(`Error occurred: ${e.message}`);
                            logger.error(`Stack: ${e.stack}`);
                            console.error("Error occurred:", e.message);
                            return res.status(500).json({ error: e.message });
                        }
                    } catch (e) {
                        logger.error(`Error occurred: ${e.message}`);
                        logger.error(`Stack: ${e.stack}`);
                        // Rollback the transaction in case of error
                        await transaction.rollback();
                        console.error('Error updating payments and user log:', e.message);
                    }
                }
            }
        } catch (e) {
            logger.error(`Error occurred: ${e.message}`);
            logger.error(`Stack: ${e.stack}`);

            res.status(500).send({ error: e.message });
        }
    }
);

app.get(`/${encodePermissions(false, false, true)}/checkout/:token/:priceID`, async (req, res) => {
    try {
        const priceId = req.params.priceID;
        const verified = jwt.verify(req.params.token, "passwordKey");
        if (!verified) {
            return res.sendStatus(401);
        }
        const user = await User.findOne({
            attributes: [
                [sq.fn("concat", sq.col("fname"), " ", sq.col("lname")), "name"],
                "email",
                "stripe_id",
                "type"
            ],
            where: { id: verified.id },
        });
        if (!user || !hasAccess(req.url.split("/")[1], user.type)) {
            return res.sendStatus(401);
        }
        const url = process.env.REDIRECT_URL || 'https://nikoniko4976.com/payment_success';

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let cust_id = user.stripe_id;

        // Step 2: Check if the user has a Stripe customer ID
        if (!cust_id) {
            const customer = await stripe.customers.create({
                name: user.name, // Using concatenated name
                email: user.email,
            });

            cust_id = customer.id;

            // Update the user's `stripe_id` in the database
            await User.update(
                { stripe_id: cust_id },
                { where: { id: verified.id } }
            );

            console.log("Customer created and stripe_id updated");
        }

        // Step 3: Create a Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            customer: cust_id,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: url,
            submit_type: "subscribe",
        });

        // Redirect to the Stripe session URL
        res.redirect(session.url);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error("Error:", e.message);
        res.sendStatus(500);
    }
});

app.get("/portalconfig", async (req, res) => {
    try {
        const configuration = await stripe.billingPortal.configurations.create({
            business_profile: {
                headline: "nikoniko",
            },
            features: {
                payment_method_update: {
                    enabled: true,
                },
                "invoice_history": {
                    "enabled": true
                },
                subscription_update: {
                    default_allowed_updates: ["price"],
                    enabled: true,
                    products: [
                        {
                            prices: ["price_1QGjyRGXGwXPwI5cKZVl3CnR", "price_1QGjyRGXGwXPwI5cBg1UuBjG"],
                            product: "prod_R9222RFbol3W2j",
                        },
                        {
                            prices: ["price_1QGk07GXGwXPwI5cbcHgIgUM", "price_1QGk07GXGwXPwI5cztfWLGmN"],
                            product: "prod_R9246yVXdfTIU9",
                        },
                        {
                            prices: ["price_1QGlQlGXGwXPwI5cbcqJ5sXZ", "price_1QGlQlGXGwXPwI5c2ocDI9BN"],
                            product: "prod_R93XiqjDVgSvBO",
                        },
                    ],
                    proration_behavior: "always_invoice",
                },
            },
            //default_return_url: "https://nikoniko4976.com/",
        });
        res.status(200).send(configuration);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        res.status(500).send({ error: e.message });
    }
});

app.get(`/${encodePermissions(false, false, true)}/portal/:token`, async (req, res) => {
    try {
        const verified = jwt.verify(req.params.token, "passwordKey");
        if (!verified) {
            return res.sendStatus(401);
        }
        const user = await User.findByPk(verified.id);
        if (!user || !hasAccess(req.url.split("/")[1], user.type)) {
            return res.sendStatus(401);
        }
        const url = process.env.REDIRECT_URL || 'https://nikoniko4976.com/';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripe_id,
            configuration: process.env.PORTAL_CONFIGURATION_ID || "bpc_1Qsqf9GXGwXPwI5cIhE3eC96",
            //return_url: url
        });
        console.log("Portal Session created");
        res.redirect(portalSession.url);
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);

        res.status(500).send({ error: e.message });
    }
}
);

async function createSupportFilesEndpoints(language) {
    try {
        const dirPath = path.join(__dirname, 'support_files', language, 'html_files');
        readdir(dirPath, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                return;
            }

            // Filter .html files
            const htmlFiles = files.filter(file => file.endsWith('.html'));
            // Create an endpoint for each HTML file
            for (const file of htmlFiles) {
                const routeName = `/support/${language}/${path.basename(file, '.html')}`;
                const filePath = path.join(dirPath, file);

                app.get(routeName, (req, res) => {
                    res.sendFile(filePath, err => {
                        if (err) {
                            console.error(`Error sending file ${filePath}:`, err);
                            res.status(500).send('Internal Server Error');
                        }
                    });
                });

                console.log(`Endpoint created: ${routeName}`);
            }
        });
    } catch (e) {
        logger.error(`Error occurred: ${e.message}`);
        logger.error(`Stack: ${e.stack}`);
        console.error(`Error reading directory or creating endpoints for ${language}:`, e);
    }
}

(async function () {
    await createSupportFilesEndpoints('en');
    await createSupportFilesEndpoints('ja');
})();

app.get('/support/en', (req, res) => {
    readFile(path.join(__dirname, 'support_files', 'en', 'support.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read JSON file' });
        }
        res.status(200).json(JSON.parse(data.toString()));
    });
});

app.get('/support/ja', (req, res) => {
    readFile(path.join(__dirname, 'support_files', 'ja', 'support.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read JSON file' });
        }
        res.status(200).json(JSON.parse(data.toString()));
    });
})

//web app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

//payment success page
app.get('/payment_success', (req, res) => {
    res.sendFile(path.join(__dirname, 'support_files', 'html_files', 'payment_success.html'));
});