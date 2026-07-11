import { google } from "googleapis";

export async function appendToSheets(data) {
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !process.env.GOOGLE_SHEET_ID ||
    !process.env.GOOGLE_SHEET_NAME
  ) {
    return false;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const currentDate = new Date().toLocaleString("kg-KG", {
      timeZone: "Asia/Bishkek",
    });

    const sheetName = process.env.GOOGLE_SHEET_NAME;

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            data.fullName,
            data.phone,
            data.direction || "",
            data.comment || "",
            data.username,
            data.telegramId,
            currentDate,
            data.statusTitle || "Новая",
          ],
        ],
      },
    });
    console.log("Данные успешно записаны в Google Sheets!");
    return true;
  } catch (error) {
    console.error("Ошибка записи в Google Sheets:", error);
    return false;
  }
}
