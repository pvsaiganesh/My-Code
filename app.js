const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const databasePath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is Running Successfully");
    });
  } catch (err) {
    console.log(`DB Error : ${err.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateJwtToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `
    SELECT 
    *
    FROM
    user
    WHERE
    username='${username}'`;
  user = await database.get(getUserQuery);
  if (user !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      createUserQuery = `
        INSERT INTO
        user (username, password, name, gender)
        VALUES
        ('${username}', '${hashedPassword}', '${name}', '${gender}')`;
      await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT 
    *
    FROM
    user
    WHERE
    username='${username}'`;
  user = await database.get(getUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passMatch = await bcrypt.compare(password, user.password);
    if (passMatch) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (request, response) => {
    let { username } = request;
    const getUserFollowing = `
    SELECT
    following_user_id    
    FROM
    follower inner join user on user.user_id=follower_user_id
    WHERE 
    username='${username}';
    `;
    const dbResponse = await database.all(getUserFollowing);
    ans = [];
    ids = [];
    for (let obj of dbResponse) {
      const ID = obj.following_user_id;
      ids.push(ID);
    }
    const getTweetsQuery = `
        SELECT
        username,
        tweet,
        tweet.date_time as dateTime
        FROM
        user inner join tweet on user.user_id=tweet.user_id
        WHERE
        user.user_id IN (${ids.toString()})
        GROUP BY
        tweet
        ORDER BY
        dateTime desc       
        LIMIT        
        4`;
    const tweets = await database.all(getTweetsQuery);
    response.send(tweets);
  }
);

app.get("/user/following/", authenticateJwtToken, async (request, response) => {
  let { username } = request;
  const getFollowingQuery = `
    SELECT
    following_user_id
    FROM
    user INNER JOIN follower on user.user_id=follower.follower_user_id
    WHERE
    username='${username}'
    `;
  dbResponse = await database.all(getFollowingQuery);
  ans = [];
  for (let obj of dbResponse) {
    let id = obj.following_user_id;
    getNameQuery = `
    SELECT
    name
    FROM
    user
    WHERE
    user_id = ${id}`;
    eachFollowingUser = await database.get(getNameQuery);
    ans.push(eachFollowingUser);
  }
  response.send(ans);
});

app.get("/user/followers/", authenticateJwtToken, async (request, response) => {
  let { username } = request;
  const getFollowersQuery = `
    SELECT
    follower_id
    FROM
    user INNER JOIN follower on user.user_id=follower.follower_user_id
    WHERE
    username='${username}';
    `;
  dbResponse = await database.all(getFollowersQuery);
  ans = [];
  for (let obj of dbResponse) {
    let id = obj.follower_id;
    getNameQuery = `
    SELECT
    name
    FROM
    user
    WHERE
    user_id=${id}`;
    final_ans = await database.get(getNameQuery);
    ans.push(final_ans);
  }
  response.send(ans);
});

app.get(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    let { username } = request;
    const getFollowingQuery = `
    SELECT
    following_user_id as ID
    FROM
    user INNER JOIN follower on user.user_id=follower.follower_user_id
    WHERE
    username='${username}'
    `;
    dbResponse = await database.all(getFollowingQuery);
    const { tweetId } = request.params;
    let ans = [];
    for (let obj of dbResponse) {
      let id = obj.ID;
      const getTweetIds = `
  SELECT
  tweet_id
  FROM
  user inner join  tweet  on tweet.user_id=user.user_id
  WHERE
user.user_id=${id}      
    `;
      const ids = await database.all(getTweetIds);
      ans.push(...ids);
    }
let final_ans;
    for (let obj of ans){
if(obj.tweet_id==tweetId){
    const getTweet=`
    select
    tweet,
    count(like_id) as likes,
    count(reply_id) as replies,
    date_time as dateTime
    from 
    tweet inner join like on tweet.tweet_id=like.tweet_id 
    inner join reply on tweet.tweet_id=reply.tweet_id
    where
    tweet.tweet_id=${tweetId}
    group by
    tweet`
    final_ans=await database.get(getTweet)
    
}        
    }
    if (final_ans === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(final_ans);
    }
  }
);
app.get("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { username } = request;
  const getId = `
  select 
  user_id
  from
  user
  where
  username='${username}'`;
  const id = await database.get(getId);
  const { user_id } = id;
  const getTweetsQuery = `
   SELECT
   tweet,
   count(like_id) as likes,
   count(reply_id) as replies,
   date_time as dateTime
   FROM
   user  natural join tweet 
   left join like on tweet.tweet_id=like.tweet_id
   left join reply on tweet.tweet_id=reply.tweet_id
   WHERE 
   tweet.user_id=${user_id}
   group by
   tweet`;
  const allTweets = await database.all(getTweetsQuery);
  response.send(allTweets);
});
app.post("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { username } = request;
  const date = new Date();
  const { tweet } = request.body;
  const getId = `
    select 
    user_id as ID
    from 
    user
    where
    username='${username}'`;
  const userId = await database.get(getId);
  const createTweet = `
    INSERT INTO 
    tweet (user_id,date_time,tweet)
    VALUES
    (${userId.ID},'${date}','${tweet}')`;
  await database.run(createTweet);
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getTweetIds = `
    SELECT
    tweet_id
    FROM
    user inner join tweet on user.user_id=tweet.user_id
    where
    username='${username}'`;
    const tweetIds = await database.all(getTweetIds);
    let i = 0;
    for (let Obj of tweetIds) {
      if (tweetId == Obj.tweet_id) {
        const removeTweet = `
            delete 
            from
            tweet
            where
            tweet_id=${tweetId}           
            `;
        await database.run(removeTweet);
        i = 1;
        response.send("Tweet Removed");
      }
    }
    if (i === 0) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get(
  "/tweets/:tweetId/likes/",
  authenticateJwtToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const getFollowingQuery = `
    SELECT
    following_user_id
    FROM
    user INNER JOIN follower on user.user_id=follower.follower_user_id
    WHERE
    username='${username}'
    `;
    dbResponse = await database.all(getFollowingQuery);
    ans = [];
    for (let obj of dbResponse) {
      let id = obj.following_user_id;
      getNameQuery = `
    SELECT
    tweet_id,
    tweet
    FROM
    user inner join tweet on user.user_id=tweet.user_id
    WHERE
    user.user_id = ${id}`;
      eachFollowingUser = await database.get(getNameQuery);
      ans.push(eachFollowingUser);
    }
    let final_ans = [];
    for (let obj of ans) {
      let id = obj.tweet_id;
      if (id == tweetId) {
        const getLikes = `
          SELECT
          username
          FROM
          user inner join like on user.user_id=like.user_id
          WHERE
          tweet_id=${id}
          group by
          user.user_id`;
        const likes = await database.all(getLikes);
        for (let obj of likes) {
          final_ans.push(obj.username);
        }
        response.send({ likes: final_ans });
      }
    }

    if (final_ans.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  authenticateJwtToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    let total_ans = [];

    const getFollowingQuery = `
    SELECT
    following_user_id
    FROM
    user INNER JOIN follower on user.user_id=follower.follower_user_id
    WHERE
    username='${username}'
    `;
    dbResponse = await database.all(getFollowingQuery);
    ans = [];
    for (let obj of dbResponse) {
      let id = obj.following_user_id;
      getNameQuery = `
    SELECT
    tweet_id
    FROM
    user inner join tweet on user.user_id=tweet.user_id
    WHERE
    user.user_id = ${id}`;
      eachFollowingUser = await database.get(getNameQuery);
      ans.push(eachFollowingUser);
    }
    const total_replies = [];
    let tweet;
    for (let obj of ans) {
      let id = obj.tweet_id;
      if (id == tweetId) {
        const getReplyIds = `
          SELECT
          name,
          reply
          FROM
          user inner join reply on user.user_id=reply.user_id
          WHERE
          tweet_id=${id}
          group by
          tweet_id          
          `;
        const replies = await database.all(getReplyIds);
        for (let obj of replies) {
          total_replies.push(obj);
        }
        getTweet = `
    select
    tweet
    from
    tweet
    where
    tweet_id=${id}`;
        tweet = await database.get(getTweet);
      }
    }
    if (total_replies.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ tweet: tweet.tweet, replies: total_replies });
    }
  }
);

module.exports = app;
