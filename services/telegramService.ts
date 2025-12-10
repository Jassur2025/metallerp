
export const telegramService = {
    sendMessage: async (token: string, chatId: string, text: string) => {
        if (!token || !chatId) {
            throw new Error('Telegram Token or Chat ID is missing');
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Telegram API Error: ${errorData.description}`);
        }

        return response.json();
    },

    sendMoneyEvent: async (
        token: string,
        chatId: string,
        event: {
            type: 'expense' | 'purchase' | 'supplier_payment' | 'client_payment' | 'sale';
            amount: number;
            currency: 'USD' | 'UZS';
            method?: 'cash' | 'bank' | 'card' | 'debt';
            counterparty?: string;
            description?: string;
            id?: string;
            date?: string;
            details?: string;
        }
    ) => {
        if (!token || !chatId) {
            throw new Error('Telegram Token or Chat ID is missing');
        }

        const fmtAmount = (val: number, cur: string) =>
            cur === 'USD'
                ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} сум`;

        const typeLabel: Record<string, string> = {
            expense: 'Расход',
            purchase: 'Закупка',
            supplier_payment: 'Оплата поставщику',
            client_payment: 'Поступление от клиента',
            sale: 'Продажа'
        };

        const emoji: Record<string, string> = {
            expense: '💸',
            purchase: '📦',
            supplier_payment: '🏭',
            client_payment: '💰',
            sale: '🛒'
        };

        const parts = [
            `<b>${emoji[event.type] || '💱'} ${typeLabel[event.type] || event.type}</b>`,
            `<b>Сумма:</b> ${fmtAmount(event.amount, event.currency)}`,
        ];

        if (event.method) parts.push(`<b>Метод:</b> ${event.method}`);
        if (event.counterparty) parts.push(`<b>Контрагент:</b> ${event.counterparty}`);
        if (event.description) parts.push(`<b>Описание:</b> ${event.description}`);
        if (event.date) parts.push(`<b>Дата:</b> ${event.date}`);
        if (event.id) parts.push(`<b>ID:</b> ${event.id}`);
        if (event.details) parts.push(`<b>Детали:</b> ${event.details}`);

        const message = parts.join('\n');
        return telegramService.sendMessage(token, chatId, message);
    },

    sendDailyReport: async (
        token: string,
        chatId: string,
        data: {
            date: string;
            revenue: number;
            grossProfit: number;
            expenses: number;
            netProfit: number;
            cashBalanceUSD: number;
            cashBalanceUZS: number;
            bankBalanceUZS: number;
            cardBalanceUZS: number;
        }
    ) => {
        const formatUSD = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const formatUZS = (val: number) => `${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} сум`;

        const message = `
<b>📊 Ежедневный Отчет: ${data.date}</b>

<b>💰 Финансы (USD):</b>
• Выручка: <b>${formatUSD(data.revenue)}</b>
• Валовая прибыль: <b>${formatUSD(data.grossProfit)}</b>
• Расходы (OPEX): <b>${formatUSD(data.expenses)}</b>
• <b>Чистая прибыль: ${formatUSD(data.netProfit)}</b>

<b>🏦 Балансы:</b>
• 💵 Касса (USD): <b>${formatUSD(data.cashBalanceUSD)}</b>
• 💵 Касса (UZS): <b>${formatUZS(data.cashBalanceUZS)}</b>
• 🏦 Р/С (UZS): <b>${formatUZS(data.bankBalanceUZS)}</b>
• 💳 Карта (UZS): <b>${formatUZS(data.cardBalanceUZS)}</b>

<i>Отправлено из Google ERP</i>
    `;

        return telegramService.sendMessage(token, chatId, message);
    }
};
