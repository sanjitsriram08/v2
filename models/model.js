const {sq} = require("../config/dbconfig");
const {DataTypes} = require("sequelize");
require('dotenv').config();
const stripe = require("stripe")(process.env.SECRET_KEY);


//user table
const User = sq.define("users", {
    id: { // Primary key with auto-increment
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    fname: { // First name (optional)
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    lname: { // Last name (optional)
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    dob: { // Date of birth (optional)
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    phone: { // Phone number (optional)
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    email: { // Email (required, unique)
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true, // Validates email format
        },
    },
    country: { // Country (optional)
        type: DataTypes.TEXT,
        allowNull: true,
    },
    state: { // State/Province (optional)
        type: DataTypes.TEXT,
        allowNull: true,
    },
    city: { // City (optional)
        type: DataTypes.TEXT,
        allowNull: true,
    },
    password: { // Password (required)
        type: DataTypes.TEXT,
        allowNull: false,
    },
    stripe_id: { // Stripe customer ID for payments (optional)
        type: DataTypes.TEXT,
        allowNull: true,
    },
    type: { // User type (optional, 3-character string)
        type: DataTypes.STRING(3),
        allowNull: true,
    },
    is_japanese: { // Boolean flag for Japanese users (default: true)
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
});

//payments table
const Payment = sq.define("payments", {
    id: { // Unique payment ID (required, stored as text)
        type: DataTypes.TEXT,
        primaryKey: true,
        allowNull: false,
    },

    user_id: { // Foreign key referencing the User table (required)
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,//users table
            key: "id",
        },
    },
    payment_date: { // Payment timestamp (stored as BIGINT, optional)
        type: DataTypes.BIGINT,
        allowNull: true, // Adjust as per your requirement
    },
    end_date: { // Subscription end timestamp (stored as BIGINT, optional)
        type: DataTypes.BIGINT,
        allowNull: true, // Adjust as per your requirement
    },
});

//user log table
const UserLog = sq.define("user_log", {
    user_id: { // Foreign key referencing the User table (required)
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,//user table
            key: "id",
        },
        onUpdate: "CASCADE", // Update on parent change
        onDelete: "CASCADE", // Delete log if user is deleted
    },
    payment_id: { // Foreign key referencing the Payment table (optional)
        type: DataTypes.TEXT,
        allowNull: true, // Change to false if necessary
        references: {
            model: Payment,
            key: "id",
        },
        onUpdate: "CASCADE", // Update on payment change
        onDelete: "CASCADE", // Delete log if payment is deleted
    },
    subscription_id: { // Subscription ID (optional)
        type: DataTypes.TEXT,
        allowNull: true, // Change to false if necessary
    },
    start_date: { // Subscription start timestamp (optional)
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    end_date: { // Subscription end timestamp (optional)
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    plan: { // Plan name (optional, max length 40 characters)
        type: DataTypes.STRING(40),
        allowNull: true,
    },
});

//client table
const Client = sq.define("clients", {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,//from user table
            key: "id",
        },
    },
    fcmtoken: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true, // Add unique constraint to fcmtoken
    },
    platform: {
        type: DataTypes.STRING(10),
        allowNull: false,
    },
});

//message table
const Message = sq.define("messages", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    sender: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    timestamp_column: {
        type: DataTypes.BIGINT,
        defaultValue: sq.literal("(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::BIGINT"), // Set default value to current timestamp in Tokyo timezone
    },
    message2: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    title2: {
        type: DataTypes.STRING(2),
        allowNull: true,
    },
    number2: {
        type: DataTypes.STRING(6),
        allowNull: true,
    },
});

//message receiver table
const MessageReceiver = sq.define("message_receiver", {
    message_id: {
        type: DataTypes.INTEGER, // Stores the ID of the related message
        references: {
            model: "messages", // References the 'id' column in the 'messages' table
            key: "id",
        },
        onUpdate: "CASCADE", // Updates message_id if the referenced message ID changes
        onDelete: "CASCADE", // Deletes this record if the referenced message is deleted
        allowNull: false, // Cannot be null, ensuring every entry has a valid message_id
    },
    receiver_id: {
        type: DataTypes.INTEGER, // Stores the ID of the user receiving the message
        references: {
            model: "users", // References the 'id' column in the 'users' table
            key: "id",
        },
        onUpdate: "CASCADE", // Updates receiver_id if the referenced user ID changes
        onDelete: "CASCADE", // Deletes this record if the referenced user is deleted
        allowNull: false, // Cannot be null, ensuring every entry has a valid receiver_id
    },
    type: {
        type: DataTypes.STRING(7), // Stores the type of message (e.g., "text", "image")
        allowNull: true, // This field is optional
    },
});

//ads table
const Ad = sq.define("ads", {
    id: {
        type: DataTypes.INTEGER, // Unique identifier for each ad
        autoIncrement: true, // Automatically increments for new entries
        primaryKey: true, // Marks this column as the primary key
    },
    title: {
        type: DataTypes.TEXT, // Stores the ad title
        allowNull: false, // Title is required (cannot be null)
    },
    description: {
        type: DataTypes.TEXT, // Stores the ad description
        allowNull: false, // Description is required
    },
    imageurl: {
        type: DataTypes.TEXT, // Stores the URL of the ad image
        allowNull: false, // Image URL is required
    },
    redirecturl: {
        type: DataTypes.TEXT, // Stores the URL where the ad redirects users
        allowNull: false, // Redirect URL is required
    },
    bgcolor: {
        type: DataTypes.STRING(20), // Stores the background color of the ad (e.g., hex or color name)
        allowNull: false, // Background color is required
    },
    titlecolor: {
        type: DataTypes.STRING(20), // Stores the color of the title text
        allowNull: false, // Title color is required
    },
    descriptioncolor: {
        type: DataTypes.STRING(20), // Stores the color of the description text
        allowNull: false, // Description color is required
    },
});

//news table
const News = sq.define("news", {
    id: {
        type: DataTypes.INTEGER, // Unique identifier for each news entry
        autoIncrement: true, // Automatically increments for new entries
        primaryKey: true, // Marks this column as the primary key
    },
    title: {
        type: DataTypes.TEXT, // Stores the news title
        allowNull: false, // Title is required (cannot be null)
    },
    description: {
        type: DataTypes.TEXT, // Stores the news description/content
        allowNull: false, // Description is required
    },
});

//adsfrequency table
const AdsFrequency = sq.define("ads_frequency", {
    frequency: {
        type: DataTypes.INTEGER, // Stores the frequency of ads
        allowNull: false, // Frequency value is required (cannot be null)
    },
});

// plan table
const Plan = sq.define(
    "plans",
    {
        id: {
            type: DataTypes.INTEGER, // Unique identifier for each plan
            autoIncrement: true, // Automatically increments for new entries
            primaryKey: true, // Marks this column as the primary key
        },
        plan_name: {
            type: DataTypes.STRING(255), // Stores the name of the plan
            allowNull: false, // Plan name is required
        },
        plan_id: {
            type: DataTypes.STRING(50), // Stores a unique identifier for the plan
            allowNull: false, // Plan ID is required
        },
        en_plan_description: {
            type: DataTypes.TEXT, // Stores the plan description in English
            allowNull: false, // Description is required
        },
        ja_plan_description: {
            type: DataTypes.TEXT, // Stores the plan description in Japanese
            allowNull: false, // Description is required
        },
        session: {
            type: DataTypes.STRING(3), // Stores session type (e.g., 'M' for monthly, 'Y' for yearly)
            allowNull: false, // Session type is required
        },
        monthly_price: {
            type: DataTypes.STRING(50), // Stores the price for the monthly plan
            allowNull: false, // Monthly price is optional
        },
        yearly_price: {
            type: DataTypes.STRING(50), // Stores the price for the yearly plan
            allowNull: false, // Yearly price is optional
        },
        monthly_price_id: {
            type: DataTypes.STRING(50), // Stores the unique ID for the monthly price (e.g., Stripe price ID)
            allowNull: false, // Monthly price ID is optional
        },
        yearly_price_id: {
            type: DataTypes.STRING(50), // Stores the unique ID for the yearly price (e.g., Stripe price ID)
            allowNull: false, // Yearly price ID is optional
        },
    },
    {
        indexes: [
            {
                unique: true, // Ensures uniqueness across specific fields
                fields: ["plan_name", "monthly_price_id", "yearly_price_id"], // Unique combination of plan name and price IDs
            },
        ],
    }
);

//votes table
const Votes = sq.define("votes", {
    K: {
        type: DataTypes.INTEGER,
        allowNull: false, // Assuming it is not nullable based on the default schema you provided
    },
    U: {
        type: DataTypes.INTEGER,
        allowNull: false, // Assuming it is not nullable based on the default schema you provided
    },
});

//enquiry table
const Enquiry = sq.define("enquiry", {
    id: {
        type: DataTypes.INTEGER, // Unique identifier for each enquiry
        autoIncrement: true, // Automatically increments for new entries
        primaryKey: true, // Marks this column as the primary key
    },
    formatted_id: {
        type: DataTypes.VIRTUAL, // Virtual field that generates a formatted ID
        get() {
            return `EQ-${this.id}`; // Formats the ID as "EQ-{id}"
        },
    },
    created_time: {
        type: DataTypes.BIGINT, // Stores the timestamp (milliseconds) when the enquiry was created
        allowNull: false, // Cannot be null
        defaultValue: sq.literal("(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)"), // Defaults to the current timestamp in milliseconds
    },
    resolved_time: {
        type: DataTypes.BIGINT, // Stores the timestamp (milliseconds) when the enquiry was resolved
        allowNull: true, // Can be null (if not resolved yet)
    },
    user_id: {
        type: DataTypes.INTEGER, // Stores the ID of the user who made the enquiry
        references: {
            model: User, // References the 'id' column in the 'User' model
            key: "id",
        },
    },
    name: {
        type: DataTypes.STRING(255), // Stores the name of the user making the enquiry
        allowNull: false, // Name is required
    },
    email: {
        type: DataTypes.STRING(255), // Stores the user's email address
        allowNull: false, // Email is required
        validate: {
            isEmail: true, // Ensures the email format is valid
        },
    },
    message: {
        type: DataTypes.TEXT, // Stores the enquiry message
        allowNull: false, // Message is required
    },
    status: {
        type: DataTypes.ENUM("resolved", "pending"), // Defines possible enquiry statuses
        allowNull: false, // Status is required
    },
});





// Define Associations
// User and UserLog: One-to-One Relationship
User.hasOne(UserLog, { foreignKey: "user_id" }); // A user has one associated log entry
UserLog.belongsTo(User, { foreignKey: "user_id" }); // The log entry belongs to a user

// Payment and UserLog: One-to-One Relationship
Payment.hasOne(UserLog, { foreignKey: "payment_id" }); // A payment has one associated log entry
UserLog.belongsTo(Payment, { foreignKey: "payment_id" }); // The log entry belongs to a payment

// User and Payment: One-to-Many Relationship
User.hasMany(Payment, { foreignKey: "user_id" }); // A user can have multiple payments
Payment.belongsTo(User, { foreignKey: "user_id" }); // A payment belongs to a single user

// Client and User: Belongs-To Relationship
Client.belongsTo(User, { foreignKey: "id" }); // A client is associated with a user (foreign key on 'id')

// Message and User: Belongs-To Relationship
Message.belongsTo(User, { foreignKey: "sender" }); // A message is associated with a sender (user)

// MessageReceiver and Message: Belongs-To Relationship
MessageReceiver.belongsTo(Message, { foreignKey: "message_id" }); // A message receiver entry belongs to a message

// MessageReceiver and User: Belongs-To Relationship
MessageReceiver.belongsTo(User, { foreignKey: "receiver_id" }); // A message receiver entry is linked to a user

// Message and MessageReceiver: One-to-Many Relationship
Message.hasMany(MessageReceiver, { foreignKey: "message_id", as: "receiver" }); // A message can have multiple receivers

/*
Tracks user actions → Links a user to their log history (User ↔ UserLog).
Tracks payments → Connects a user to their payments (User ↔ Payment).
Stores messages → Links a message to its sender and receivers (Message ↔ User, Message ↔ MessageReceiver).
Manages clients → Connects a client to a user (Client ↔ User).
Prevents data issues → Ensures each record (payment, message, etc.) is linked correctly.
*/



//we are creating the table in here

//alter: false → Does not modify existing table structure.
// force: false → Does not drop & recreate tables (prevents data loss).
User.sync({ alter: false, force: false }).then(() => {
    console.log("User Model synced"); // Ensures the User table exists

    // Sync the Message model after User model is synced
    Message.sync({ alter: false, force: false }).then(() => {
        console.log("Message Model synced"); // Ensures the Message table exists

        // Sync the MessageReceiver model after Message model is synced
        MessageReceiver.sync({ alter: false, force: false }).then(() => {
            console.log("Message Receiver Model synced"); // Ensures the MessageReceiver table exists
        });
    });

    // Sync the Payment model after User model is synced
    Payment.sync({ alter: false, force: false }).then(() => {
        console.log("Payment Model synced"); // Ensures the Payment table exists

        // Sync the UserLog model after Payment model is synced
        UserLog.sync({ alter: false, force: false }).then(() => {
            console.log("User Log Model synced"); // Ensures the UserLog table exists
        });
    });

    // Sync the Client model after User model is synced
    Client.sync({ alter: false, force: false }).then(() => {
        console.log("Client Model synced"); // Ensures the Client table exists
    });

    // Sync the Enquiry model after User model is synced
    Enquiry.sync({ alter: false, force: false }).then(() => {
        console.log("Enquiry Model synced"); // Ensures the Enquiry table exists
    });
});


Ad.sync({ alter: false, force: false }).then(() => {
    console.log("Ad Model synced");
});

News.sync({ alter: false, force: false }).then(() => {
    console.log("News Model synced");
});

Votes.sync({ alter: false, force: false }).then(async () => {
    console.log("Votes Model synced");
});

AdsFrequency.sync({ alter: false, force: false }).then(async () => {
    console.log("Ad Frequency Model synced"); // Logs when the table is synced

    const existingFrequency = await AdsFrequency.findOne(); // Checks if any record exists

    if (!existingFrequency) {
        await AdsFrequency.create({ frequency: 1 }); // Inserts a default record if none exist
    } else {
        console.log("Record already exists:", existingFrequency.dataValues); // Logs the existing record
    }
});


Plan.sync({force: true}).then(async () => {
    console.log("Plan Model synced");
    await syncStripePlans();
});



async function syncStripePlans() {
    try {
        // Fetch active products from Stripe
        const plans = await stripe.products.list({ active: true });

        // Loop through each product
        for (const plan of plans.data) {
            // Fetch pricing details for the product
            const prices = await stripe.prices.list({ product: plan.id });

            let monthlyPrice = null;
            let yearlyPrice = null;
            let monthlyPriceId = null;
            let yearlyPriceId = null;

            // Loop through the prices and categorize them as monthly or yearly
            for (const price of prices.data) {
                const priceWithCurrency = `${{
                    usd: '$',
                    jpy: '¥',
                    inr: '₹',
                    eur: '€',
                    // Add more currencies as needed
                }[price.currency.toLowerCase()]} ${price.unit_amount}`;

                // Check if the price is for a monthly plan
                if (price.recurring && price.recurring.interval === 'month') {
                    monthlyPrice = priceWithCurrency;
                    monthlyPriceId = price.id;
                }
                // Check if the price is for a yearly plan
                else if (price.recurring && price.recurring.interval === 'year') {
                    yearlyPrice = priceWithCurrency;
                    yearlyPriceId = price.id;
                }
            }

            // Extract metadata (descriptions and session type) from the product
            const enDescription = plan.metadata.en || '';
            const jaDescription = plan.metadata.ja || '';
            const session = plan.metadata.session || '';

            // Save the product details into the database
            await Plan.create({
                plan_name: plan.name,
                plan_id: plan.id,
                en_plan_description: enDescription,
                ja_plan_description: jaDescription,
                session: session,
                monthly_price: monthlyPrice,
                yearly_price: yearlyPrice,
                monthly_price_id: monthlyPriceId,
                yearly_price_id: yearlyPriceId,
            });
        }

        console.log('Stripe products synced successfully!');
    } catch (error) {
        // Handle and log errors
        console.error('Error syncing products:', error);
    }
}


module.exports = {
    User,
    UserLog,
    Payment,
    Client,
    Message,
    MessageReceiver,
    Ad,
    AdsFrequency,
    Plan,
    News,
    Votes,
    Enquiry
};


// define() → Defines the structure.
//sync() → Creates the table in the database.
//associations → Links tables together.
//syncStripePlans() → Fetches and syncs Stripe plans with the database.
//module.exports → Exports the models for use in other files.

