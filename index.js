require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppURL = process.env.WEB_APP_URL;
const PORT = process.env.PORT || 8000;
const SERVER_URL = process.env.SERVER_URL;

//const bot = new TelegramBot(token, { polling: true });
const bot = new TelegramBot(token);

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
    await bot.sendMessage(chatId, 'Ниже появится кнопка, заполни форму', {
      reply_markup: {
        keyboard: [[{ text: 'Сделать заказ', web_app: { url: webAppURL + 'form' } }]]
      }
    });

    await bot.sendMessage(chatId, 'Заходи в магазин', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Сделать заказ', web_app: { url: webAppURL } }]]
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

app.listen(PORT, () => console.log('server started on PORT ' + PORT));
