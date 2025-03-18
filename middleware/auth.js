const jwt = require("jsonwebtoken");
const { User } = require('../models/model'); // Adjust the path to your models
const {hasAccess} = require('../utils/authUtil');

/***
 URL CONFIGURATION
     3 bits -> superAdmin | admin | user
     111 -> all (7)
     011 -> admin and user (3)
     001 -> only user (1)
     100 -> only superAdmin (4)
     010 -> only admin (2)
***/

const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) {
      return res.sendStatus(401);
    }

    const verified = jwt.verify(token, "passwordKey");
    if (!verified) {
      return res.sendStatus(401);
    }

    const user = await User.findByPk(verified.id);
    console.log(req.url.split("/"));
    if (!user || !hasAccess(req.url.split("/")[2], user.type)) {
      return res.sendStatus(401);
    }

    console.log("Valid token");
    req.id = verified.id;
    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
};

module.exports = auth;