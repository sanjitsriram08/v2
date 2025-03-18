const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(process.env.cryptKey, 'hex');

function encrypt(text){
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Combine IV and encrypted text using a separator (e.g., ':')
    const combined = iv.toString('hex') + ':' + encrypted;
    return combined;
}

function decrypt(combined){
    // Split the combined string to get IV and encrypted text
    const [iv, encrypted] = combined.split(':');
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };