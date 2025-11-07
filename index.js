require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const crypto = require('crypto');
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
        keyboard: [[{ text: 'Заполни меня', web_app: { url: webAppURL + 'form' } }]]
      }
    });

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
  const { initData } = req.body;

  if (!initData) {
    return res.status(400).json({ success: false, error: 'No initData' });
  }

  const params = Object.fromEntries(new URLSearchParams(initData)); //распарсили строку

  const checkHash = params.hash; //выделяем хэш и удаляем его из данных
  delete params.hash;

  //собираем data-check-string
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');

  //собираем secret_key
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();

  //Считаем hash от data_check_string с использованием secret_key
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  //Сравниваем хэши
  if (hmac !== checkHash) {
    return res.json({ success: false, error: 'Invalid hash' });
  }

  // Проверим время (auth_date не старше часа)
  const now = Math.floor(Date.now() / 1000);
  if (now - Number(params.auth_date) > 3600) {
    return res.json({ success: false, error: 'Auth data expired' });
  }

  const user = JSON.parse(decodeURIComponent(params.user));

  res.json({ success: true, user });
});

app.listen(PORT, () => console.log('server started on PORT ' + PORT));
