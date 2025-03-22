const {sq} = require("../config/dbconfig");
const {DataTypes} = require("sequelize");
require('dotenv').config();
const stripe = require("stripe")(process.env.SECRET_KEY);

const User = sq.define("users", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    fname: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    lname: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    country: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    state: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    city: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    password: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    stripe_id: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    type: {
        type: DataTypes.STRING(3),
        allowNull: true,
    },
    is_japanese: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
});

const Payment = sq.define("payments", {
    id: {
        type: DataTypes.TEXT,
        primaryKey: true,
        allowNull: false,
    },

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: "id",
        },
    },
    payment_date: {
        type: DataTypes.BIGINT,
        allowNull: true, // Adjust as per your requirement
    },
    end_date: {
        type: DataTypes.BIGINT,
        allowNull: true, // Adjust as per your requirement
    },
});

const UserLog = sq.define("user_log", {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
    },
    payment_id: {
        type: DataTypes.TEXT,
        allowNull: true, // Change to false if necessary
        references: {
            model: Payment,
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
    },
    subscription_id: {
        type: DataTypes.TEXT,
        allowNull: true, // Change to false if necessary
    },
    start_date: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    end_date: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    plan: {
        type: DataTypes.STRING(40),
        allowNull: true,
    },
});

const Client = sq.define("clients", {
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
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

const MessageReceiver = sq.define("message_receiver", {
    message_id: {
        type: DataTypes.INTEGER,
        references: {
            model: "messages",
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false,
    },
    receiver_id: {
        type: DataTypes.INTEGER,
        references: {
            model: "users",
            key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING(7),
        allowNull: true, // Adjust nullable constraint based on your requirements
    },
});

const Ad = sq.define("ads", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    imageurl: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    redirecturl: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    bgcolor: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    titlecolor: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    descriptioncolor: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
});

const News = sq.define("news", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
});

const AdsFrequency = sq.define("ads_frequency", {
    frequency: {
        type: DataTypes.INTEGER,
        allowNull: false, // Assuming it is not nullable based on the default schema you provided
    },
});

const Plan = sq.define(
    "plans",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        plan_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        plan_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        en_plan_description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        ja_plan_description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        session: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        monthly_price: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        yearly_price: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        monthly_price_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        yearly_price_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
    },
    {
        indexes: [
            {
                unique: true,
                fields: ["plan_name", "monthly_price_id", "yearly_price_id"],
            },
        ],
    }
);

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

const Enquiry = sq.define("enquiry", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    formatted_id: {
        type: DataTypes.VIRTUAL,
        get() {
            return `EQ-${this.id}`;
        },
    },
    created_time: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: sq.literal("(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)")
    },
    resolved_time: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: "id",
        },
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: true,
        },
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false, // Assuming it is not nullable based on the default schema you provided
    },
    status: {
        type: DataTypes.ENUM("resolved", "pending"),
        allowNull: false, // Assuming it is not nullable based on the default schema you provided
    },
});

// Define Associations
User.hasOne(UserLog, {foreignKey: "user_id"});
UserLog.belongsTo(User, {foreignKey: "user_id"});
Payment.hasOne(UserLog, {foreignKey: "payment_id"});
UserLog.belongsTo(Payment, {foreignKey: "payment_id"});
User.hasMany(Payment, {foreignKey: "user_id"});
Payment.belongsTo(User, {foreignKey: "user_id"});
Client.belongsTo(User, {foreignKey: "id"});
Message.belongsTo(User, {foreignKey: "sender"});
MessageReceiver.belongsTo(Message, {foreignKey: "message_id"});
MessageReceiver.belongsTo(User, {foreignKey: "receiver_id"});
Message.hasMany(MessageReceiver, {foreignKey: "message_id", as: "receiver"});

User.sync({ alter: false, force: false }).then(() => {
    console.log("User Model synced");

    Message.sync({ alter: false, force: false }).then(() => {
        console.log("Message Model synced");

        MessageReceiver.sync({ alter: false, force: false }).then(() => {
            console.log("Message Receiver Model synced");
        });
    });

    Payment.sync({ alter: false, force: false }).then(() => {
        console.log("Payment Model synced");

        UserLog.sync({ alter: false, force: false }).then(() => {
            console.log("User Log Model synced");
        });
    });

    Client.sync({ alter: false, force: false }).then(() => {
        console.log("Client Model synced");
    });

    Enquiry.sync({ alter: false, force: false }).then(() => {
        console.log("Enquiry Model synced");
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
    console.log("Ad Frequency Model synced");

    const existingFrequency = await AdsFrequency.findOne();

    if (!existingFrequency) {
        await AdsFrequency.create({frequency: 1});
    } else {
        console.log('Record already exists:', existingFrequency.dataValues);
    }
});

Plan.sync({force: true}).then(async () => {
    console.log("Plan Model synced");
    await syncStripePlans();
});

async function syncStripePlans() {
    try {
        // Fetch products from Stripe
        const plans = await stripe.products.list({active: true});

        for (const plan of plans.data) {
            // Fetch prices for the product
            const prices = await stripe.prices.list({product: plan.id});

            let monthlyPrice = null;
            let yearlyPrice = null;
            let monthlyPriceId = null;
            let yearlyPriceId = null;

            for (const price of prices.data) {
                const priceWithCurrency = `${{
                    usd: '$',
                    jpy: '¥',
                    inr: '₹',
                    eur: '€',
                    // Add more currencies as needed
                }[price.currency.toLowerCase()]} ${price.unit_amount}`;
                if (price.recurring && price.recurring.interval === 'month') {
                    monthlyPrice = priceWithCurrency;
                    monthlyPriceId = price.id;
                } else if (price.recurring && price.recurring.interval === 'year') {
                    yearlyPrice = priceWithCurrency;
                    yearlyPriceId = price.id;
                }
            }

            const enDescription = plan.metadata.en || '';
            const jaDescription = plan.metadata.ja || '';
            const session = plan.metadata.session || '';

            // Save product details to DB
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