const googleAuth = require('google-auth-library');

var key = require("../config/push-key.json");
 
module.exports = () => {
    
    var _jwtClient = new googleAuth.JWT(
        key.client_email,
        null,
        key.private_key,
        ['https://www.googleapis.com/auth/firebase.messaging'],
        null
      );
    
      var _getAccessToken = function() {
    
        return new Promise(function(resolve, reject) {
          _jwtClient.authorize(function(error, tokens) {
            if (error) {
              reject(error);
              return;
            }
            resolve(tokens.access_token);
          });
        });
      };

var _sendMsg = async function(message){
    console.log(`Message Sent to ${message.message.token}`);
    try{
    return await _jwtClient.request({
        method: 'post',
        url: 'https://fcm.googleapis.com/v1/projects/nikoniko-1212/messages:send',
        data: message
    });
  }catch(e){
    console.log(e.message);
    return e;
  }
}   

    return {
        getAccessToken: _getAccessToken,
        sendMessage: _sendMsg
    }
}