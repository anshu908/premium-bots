const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
require('dotenv').config();

const token ="7981716643:AAFWlWHIKUpUlnijTc8m4eHvBsdQRJ2KUHA"
const ownerId = "6258915779 "
const channelId1 = '@RishuAPI';
const channelId2 = '@Rishu_mood';
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const UserSchema = new mongoose.Schema({
    userId: Number,
    firstName: String,
    username: String,
    rating: Number
});
const User = mongoose.model('User', UserSchema);

const bot = new TelegramBot(token, { polling: true });

async function checkUserInChannel(channelId, userId) {
    try {
        const res = await bot.getChatMember(channelId, userId);
        return res.status === 'member' || res.status === 'administrator' || res.status === 'creator';
    } catch (err) {
        console.error(`Error checking membership for channel ${channelId}:`, err);
        return false;
    }
}

async function sendWelcomeMessage(chatId) {
    const welcomeMessage = "🎉 Welcome! You are now a member of both channels and can use the bot. How can I assist you today?";
    const photo = 'https://envs.sh/bJh.jpg';
    
    const buttons = [
        [{ text: 'Help', callback_data: 'help' }],
        [{ text: 'Support', callback_data: 'support' }],
        [{ text: 'Rate the Bot', callback_data: 'rate_bot' }]
    ];
    
    await bot.sendPhoto(chatId, photo, {
        caption: welcomeMessage,
        reply_markup: { inline_keyboard: buttons }
    });
}

async function askForRating(chatId) {
    const ratingButtons = [
        [{ text: '⭐⭐⭐⭐⭐', callback_data: 'rate_5' }],
        [{ text: '⭐⭐⭐⭐', callback_data: 'rate_4' }],
        [{ text: '⭐⭐⭐', callback_data: 'rate_3' }],
        [{ text: '⭐⭐', callback_data: 'rate_2' }],
        [{ text: '⭐', callback_data: 'rate_1' }]
    ];
    bot.sendMessage(chatId, 'Please rate the bot (1-5 stars):', {
        reply_markup: { inline_keyboard: ratingButtons }
    });
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    let user = await User.findOne({ userId });
    if (!user) {
        user = new User({
            userId,
            firstName: msg.from.first_name,
            username: msg.from.username,
            rating: null
        });
        await user.save();
        bot.sendMessage(ownerId, `🥳 New user started the bot: ${msg.from.first_name} (ID: ${userId}).`);
    }

    const isInChannel1 = await checkUserInChannel(channelId1, userId);
    const isInChannel2 = await checkUserInChannel(channelId2, userId);
    
    if (isInChannel1 && isInChannel2) {
        sendWelcomeMessage(chatId);
    } else {
        let message = 'Please join both channels first to use the bot:';
        let buttons = [];
        if (!isInChannel1) {
            buttons.push([{ text: `Join ${channelId1}`, url: `https://t.me/${channelId1.replace('@', '')}` }]);
        }
        if (!isInChannel2) {
            buttons.push([{ text: `Join ${channelId2}`, url: `https://t.me/${channelId2.replace('@', '')}` }]);
        }
        bot.sendMessage(chatId, message, { reply_markup: { inline_keyboard: buttons } });
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    if (data === 'rate_bot') {
        let user = await User.findOne({ userId });
        if (user.rating) {
            bot.sendMessage(chatId, 'You have already rated the bot.');
        } else {
            askForRating(chatId);
        }
    } else if (data.startsWith('rate_')) {
        const rating = parseInt(data.split('_')[1]);
        let user = await User.findOne({ userId });
        if (user.rating) {
            bot.sendMessage(chatId, 'You have already rated the bot.');
        } else {
            user.rating = rating;
            await user.save();
            bot.sendMessage(ownerId, `⭐ User ${user.firstName} (Username: ${user.username}, ID: ${userId}) rated the bot ${rating}/5 stars.`);
            bot.sendMessage(chatId, `Thank you for rating the bot ${rating}/5 stars!`);
        }
    }
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const broadcastMessage = match[1];
    
    if (chatId.toString() === ownerId) {
        const users = await User.find();
        users.forEach(user => bot.sendMessage(user.userId, `📢 Broadcast: ${broadcastMessage}`));
    } else {
        bot.sendMessage(chatId, "❌ You are not authorized to use this command.");
    }
});
