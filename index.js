require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppURL = process.env.WEB_APP_URL;
const PORT = process.env.PORT || 8000;
const SERVER_URL = process.env.SERVER_URL;

const bot = new TelegramBot(token, { polling: true });
//const bot = new TelegramBot(token);

const app = express();

app.use(express.json());
app.use(cors());

bot.setWebHook(`${SERVER_URL}/bot${token}`);

app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '/start') {
    // await bot.sendMessage(chatId, 'Ниже появится кнопка, заполни форму', {
    //   reply_markup: {
    //     keyboard: [[{ text: 'Сделать заказ', web_app: { url: webAppURL + 'form' } }]]
    //   }
    // });

    await bot.sendMessage(chatId, 'Заходи в магазин', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Сделать заказ', web_app: { url: webAppURL } }]]
      }
    });
  }

  if (text === '/login') {
    await bot.sendMessage(chatId, 'Присоединяйся к нам!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Зарегистрироваться', web_app: { url: webAppURL + 'login' } }]]
      }
    });
  }

  if (msg?.web_app_data?.data) {
    //получаем данные отправленные с веб приложения
    try {
      const data = JSON.parse(msg.web_app_data?.data);

      await bot.sendMessage(chatId, 'Спасибо за обратную связь!');
      await bot.sendMessage(chatId, 'Ваша страна ' + data?.country);
      await bot.sendMessage(chatId, 'Ваша улица ' + data?.street);

      setTimeout(async () => {
        await bot.sendMessage(chatId, 'Вся информация доступна в этом чате');
      }, 3000);
    } catch (e) {
      console.log(e);
    }
  }
});

//код на получение пост запроса
app.post('/web-data', async (req, res) => {
  const { queryId, products, totalPrice } = req.body;
  console.log(queryId);

  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'Успешная покупка',
      input_message_content: {
        message_text: 'Поздравляю с покупкой, вы приобрели товар на сумму ' + totalPrice
      }
    });
    return res.status(200).json({});
  } catch (e) {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'Не удалось приобрести товар',
      input_message_content: {
        message_text: 'Не удалось приобрести товар'
      }
    });
  }
  return res.status(500).json();
});

app.post('/auth', async (req, res) => {
  const data = req.body;
  console.log('Auth request:', data);

  if (!data.hash || !data.id || !data.auth_date) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (hash !== data.hash) {
    console.log('Invalid hash from Telegram');
    return res.status(403).json({ success: false, message: 'Invalid hash' });
  }

  const user = {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    username: data.username,
    photo_url: data.photo_url
  };

  // здесь можно добавить пользователя в БД
  console.log('Auth successful:', user);

  return res.status(200).json({
    success: true,
    user
  });
});

app.listen(PORT, () => console.log('server started on PORT ' + PORT));
