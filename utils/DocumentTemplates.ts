import { jsPDF } from 'jspdf';
import { Order, AppSettings, OrderItem } from '../types';

// Utility to load custom font if needed, for now we rely on standard fonts or add base64 later if cyrillic fails.
// Note: jsPDF default fonts might not support Cyrillic. We often need a custom font.
// For this environment, we'll try to use a standard font or a CDN link if possible,
// but usually we embed a base64 font. To keep it simple first, we'll try to use 'helvetica' (which often fails for Cyrillic)
// OR we rely on html2canvas approach effectively which we used for the receipt.
// However, html2canvas is pixelated.
// A better approach for professional docs is pure jsPDF with a Cyrillic compatible font.
// Since I cannot download files easily, I will use a base64 encoded string of a font like Roboto or OpenSans in a separate file if needed.
// BUT, for now, let's try the HTML -> Canvas -> PDF approach as it is safer for encoding in this constrained env.
import html2canvas from 'html2canvas';

export const generateInvoicePDF = async (order: Order, settings: AppSettings) => {
    // We will construct a hidden HTML element, render it to canvas, then to PDF.
    // This allows full CSS styling control and perfect Cyrillic support without managing font files.

    const dateStr = new Date(order.date).toLocaleDateString('ru-RU');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const company = (settings.companyDetails || {}) as any;

    // Calculate totals
    const totalAmount = order.totalAmountUZS;
    const items = order.items;

    const htmlContent = `
    <div id="invoice-node" style="width: 800px; padding: 40px; background: white; color: black; font-family: 'Arial', sans-serif;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div>
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">СЧЕТ НА ОПЛАТУ № ${order.id.slice(-6)}</h1>
                <p style="margin: 5px 0;">от ${dateStr}</p>
            </div>
            <div style="text-align: right;">
                <h3 style="margin: 0; font-weight: bold;">${company.name || 'Организация'}</h3>
                ${company.address ? `<p style="margin: 2px 0; font-size: 12px;">${company.address}</p>` : ''}
                ${company.phone ? `<p style="margin: 2px 0; font-size: 12px;">Тел: ${company.phone}</p>` : ''}
            </div>
        </div>

        <div style="border: 1px solid #000; padding: 10px; margin-bottom: 20px; font-size: 12px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 150px; font-weight: bold;">Поставщик:</td>
                    <td>${company.name || '-'}, ИНН: ${company.inn || '-'}, р/с: ${company.accountNumber || '-'} в ${company.bankName || '-'}, МФО: ${company.mfo || '-'}</td>
                </tr>
                <tr><td colspan="2" style="height: 10px;"></td></tr>
                <tr>
                    <td style="font-weight: bold;">Покупатель:</td>
                    <td>${order.customerName}</td>
                </tr>
            </table>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <thead style="background: #f0f0f0;">
                <tr>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 40px;">№</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left;">Товар / Услуга</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 60px;">Ед.</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">Кол-во</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 100px;">Цена</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: right; width: 120px;">Сумма</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item, index) => {
        const price = item.priceAtSale * order.exchangeRate;
        const sum = item.total * order.exchangeRate;
        return `
                    <tr>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${item.productName}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.unit}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.quantity}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${price.toLocaleString()}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${sum.toLocaleString()}</td>
                    </tr>
                    `;
    }).join('')}
            </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 30px; font-size: 14px;">
            <p style="margin: 5px 0;"><b>Итого:</b> ${totalAmount.toLocaleString()} сум</p>
            <p style="margin: 5px 0;"><b>В т.ч. НДС (${order.vatRateSnapshot}%):</b> ${(order.vatAmount * order.exchangeRate).toLocaleString()} сум</p>
            <p style="margin: 5px 0; font-size: 16px;"><b>Всего к оплате:</b> ${totalAmount.toLocaleString()} сум</p>
        </div>

        <div style="margin-top: 40px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                <div style="width: 45%;">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px;"></div>
                    <div style="font-size: 10px; text-align: center;">Руководитель предприятия</div>
                    <div style="text-align: center; font-weight: bold;">${company.director || '(подпись)'}</div>
                </div>
                <div style="width: 45%;">
                    <div style="border-bottom: 1px solid #000; margin-bottom: 5px;"></div>
                    <div style="font-size: 10px; text-align: center;">Главный бухгалтер</div>
                    <div style="text-align: center; font-weight: bold;">${company.accountant || '(подпись)'}</div>
                </div>
            </div>
        </div>
    </div>
    `;

    await generateAndSavePDF(htmlContent, `Invoice_${order.id}.pdf`);
};

export const generateWaybillPDF = async (order: Order, settings: AppSettings) => {
    const dateStr = new Date(order.date).toLocaleDateString('ru-RU');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const company = (settings.companyDetails || {}) as any;
    const items = order.items;

    const htmlContent = `
    <div id="waybill-node" style="width: 800px; padding: 40px; background: white; color: black; font-family: 'Arial', sans-serif;">
         <div style="text-align: right; font-size: 12px; margin-bottom: 20px;">
            Типовая форма № ТОРГ-12
        </div>
        
        <h2 style="text-align: center; margin-bottom: 10px;">ТОВАРНАЯ НАКЛАДНАЯ № ${order.id.slice(-6)}</h2>
        <p style="text-align: center; margin-bottom: 20px;">от ${dateStr}</p>

        <div style="margin-bottom: 20px; font-size: 12px; line-height: 1.6;">
            <table style="width: 100%;">
                <tr>
                    <td style="width: 100px; vertical-align: top;">Грузоотправитель:</td>
                    <td style="border-bottom: 1px solid #ccc;">${company.name || '___________'}, ${company.address || ''}, ${company.phone || ''}</td>
                </tr>
                <tr>
                    <td style="vertical-align: top;">Грузополучатель:</td>
                    <td style="border-bottom: 1px solid #ccc;">${order.customerName}</td>
                </tr>
                 <tr>
                    <td style="vertical-align: top;">Основание:</td>
                    <td style="border-bottom: 1px solid #ccc;">Договор / Заказ № ${order.id}</td>
                </tr>
            </table>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
            <thead style="background: #f0f0f0;">
                <tr>
                    <th style="border: 1px solid #000; padding: 4px;">№</th>
                    <th style="border: 1px solid #000; padding: 4px;">Наименование товара</th>
                    <th style="border: 1px solid #000; padding: 4px;">Ед. изм.</th>
                    <th style="border: 1px solid #000; padding: 4px;">Кол-во</th>
                    <th style="border: 1px solid #000; padding: 4px;">Цена</th>
                    <th style="border: 1px solid #000; padding: 4px;">Сумма с НДС</th>
                </tr>
            </thead>
            <tbody>
                 ${items.map((item, index) => {
        const price = item.priceAtSale * order.exchangeRate;
        const sum = item.total * order.exchangeRate;
        return `
                    <tr>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${item.productName}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.unit}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.quantity}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${price.toLocaleString()}</td>
                        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${sum.toLocaleString()}</td>
                    </tr>
                    `;
    }).join('')}
                 <tr>
                    <td colspan="5" style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">Итого:</td>
                    <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${order.totalAmountUZS.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top: 40px; font-size: 12px;">
            <table style="width: 100%;">
                <tr>
                    <td style="width: 45%; vertical-align: bottom;">
                        <div>Отпуск груза разрешил</div>
                        <div style="margin-top: 30px; border-bottom: 1px solid #000;"></div>
                        <div style="font-size: 10px; text-align: center;">(должность, подпись, расшифровка)</div>
                    </td>
                    <td style="width: 10%;"></td>
                    <td style="width: 45%; vertical-align: bottom;">
                        <div>Груз получил</div>
                        <div style="margin-top: 30px; border-bottom: 1px solid #000;"></div>
                        <div style="font-size: 10px; text-align: center;">(должность, подпись, расшифровка)</div>
                    </td>
                </tr>
            </table>
        </div>
    </div>
    `;

    await generateAndSavePDF(htmlContent, `Waybill_${order.id}.pdf`);
};

async function generateAndSavePDF(html: string, filename: string) {
    // Create hidden container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const element = container.firstElementChild as HTMLElement;

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // Higher quality
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        // A4 size: 210 x 297 mm
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        pdf.save(filename);

    } catch (err) {
        console.error("PDF Generation failed", err);
        alert("Ошибка при создании PDF");
    } finally {
        document.body.removeChild(container);
    }
}
