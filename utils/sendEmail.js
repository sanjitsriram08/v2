const nodeMailer = require("nodemailer");


const sendEmail = async (options) => {
    try {
        const transporter = nodeMailer.createTransport({
            host: process.env.SMPT_HOST || 'smtp.gmail.com',
            port: process.env.SMPT_PORT || 465,
            secure: true, // Use SSL
            tls: {
                rejectUnauthorized: false
            },
            auth: {
                type: 'login',
                user: process.env.SMPT_MAIL || 'yuvaprajan2020@gmail.com',
                pass: process.env.SMPT_APP_PASS || 'rdgocgrpnwfxogep',
            }
        });

        const mailOptions = {
            from: process.env.SMPT_MAIL,
            to: options.to,
            subject: options.subject,
            html: options.message,
        };

        // Send the email and await the result
        const info = await transporter.sendMail(mailOptions);

        // Log the email status
        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('Preview URL:', nodeMailer.getTestMessageUrl(info));
    } catch (e) {
        throw e;
    }
};

module.exports = sendEmail;