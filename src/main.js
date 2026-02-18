
/**
 * Расчет выручки от продажи товара с учетом скидки
 * @param {Object} purchase - информация о проданном товаре из чека
 * @param {Object} _product - информация о товаре из каталога (не используется в этой реализации)
 * @returns {number} - выручка от продажи
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    
    // Коэффициент для расчета суммы без скидки: 1 - (скидка в процентах / 100)
    const discountFactor = 1 - (discount / 100);
    
    // Выручка = цена продажи * количество * коэффициент скидки
    return sale_price * quantity * discountFactor;
}

/**
 * Расчет бонуса продавца на основе его места в рейтинге
 * @param {number} index - место в рейтинге (0 - первое место)
 * @param {number} total - общее количество продавцов
 * @param {Object} seller - данные о продавце (содержит profit)
 * @returns {number} - размер бонуса в рублях
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    
    // Проверка на отрицательную прибыль - бонус не начисляется
    if (profit <= 0) {
        return 0;
    }
    
    // Первое место (индекс 0) - 15% от прибыли
    if (index === 0) {
        return profit * 0.15;
    }
    
    // Второе и третье место (индексы 1 и 2) - 10% от прибыли
    if (index === 1 || index === 2) {
        return profit * 0.10;
    }
    
    // Последнее место - 0%
    if (index === total - 1) {
        return 0;
    }
    
    // Все остальные продавцы - 5% от прибыли
    return profit * 0.05;
}

/**
 * Основная функция анализа данных о продажах
 * @param {Object} data - объект с данными о покупателях, товарах, продавцах и чеках
 * @param {Object} options - объект с функциями для расчета выручки и бонуса
 * @returns {Array} - массив с отчетами по каждому продавцу
 */
function analyzeSalesData(data, options) {
    // ===== ШАГ 1: ПРОВЕРКА ВХОДНЫХ ДАННЫХ =====
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // ===== ШАГ 2: ПРОВЕРКА НАЛИЧИЯ ОПЦИЙ =====
    if (typeof options !== 'object' || options === null) {
        throw new Error('Опции должны быть объектом');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Не переданы функции для расчета');
    }

    // ===== ШАГ 3: ПОДГОТОВКА ПРОМЕЖУТОЧНЫХ ДАННЫХ =====
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {} // объект для сбора проданных товаров: { [sku]: quantity }
    }));

    // ===== ШАГ 4: ИНДЕКСАЦИЯ ДЛЯ БЫСТРОГО ДОСТУПА =====
    // Индекс продавцов для быстрого доступа по id
    const sellerIndex = sellerStats.reduce((acc, seller) => {
        acc[seller.id] = seller;
        return acc;
    }, {});
    
    // Индекс товаров для быстрого доступа по sku
    const productIndex = data.products.reduce((acc, product) => {
        acc[product.sku] = product;
        return acc;
    }, {});

    // ===== ШАГ 5: РАСЧЕТ ВЫРУЧКИ И ПРИБЫЛИ ДЛЯ КАЖДОГО ПРОДАВЦА =====
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден`);
            return;
        }
        
        // Увеличиваем количество продаж
        seller.sales_count++;
        
        // Добавляем выручку из чека
        seller.revenue += record.total_amount;
        
        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            if (!product) {
                console.warn(`Товар с sku ${item.sku} не найден`);
                return;
            }
            
            // Себестоимость товаров = закупочная цена * количество
            const cost = product.purchase_price * item.quantity;
            
            // Выручка с учетом скидки (используем переданную функцию)
            const revenue = calculateRevenue(item, product);
            
            // Прибыль = выручка - себестоимость
            const profit = revenue - cost;
            
            // Добавляем прибыль к общей прибыли продавца
            seller.profit += profit;
            
            // Увеличиваем счетчик проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // ===== ШАГ 6: СОРТИРОВКА ПРОДАВЦОВ ПО ПРИБЫЛИ =====
    const sortedSellers = [...sellerStats].sort((a, b) => b.profit - a.profit);

    // ===== ШАГ 7: НАЗНАЧЕНИЕ ПРЕМИЙ НА ОСНОВЕ РАНЖИРОВАНИЯ =====
    const totalSellers = sortedSellers.length;
    
    sortedSellers.forEach((seller, index) => {
        // Рассчитываем бонус
        seller.bonus = calculateBonus(index, totalSellers, seller);
        
        // Формируем топ-10 товаров
        const productsArray = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        seller.top_products = productsArray;
    });

    // ===== ШАГ 8: ПОДГОТОВКА ИТОГОВОЙ КОЛЛЕКЦИИ =====
    return sortedSellers.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}