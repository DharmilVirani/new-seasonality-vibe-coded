const prisma = require('../utils/prisma');
const { AuthorizationError, ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

const MONTH_SHORT_TO_NUM = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const MONTH_UPPER_TO_NUM = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const MAX_BASKET_SYMBOLS = 50;

function toDate(dateValue) {
  if (!dateValue) return null;
  return new Date(dateValue);
}

function safeRound(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(Number(value).toFixed(digits));
}

function median(sorted) {
  if (!sorted.length) return null;
  if (sorted.length % 2 === 0) {
    const i = sorted.length / 2;
    return (sorted[i] + sorted[i - 1]) / 2;
  }
  return sorted[Math.floor(sorted.length / 2)];
}

function computePopulationStd(values, avg) {
  if (values.length <= 1) return null;
  const sqDiffSum = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0);
  return Math.sqrt(sqDiffSum / values.length);
}

class BasketAnalysisService {
  normalizeSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      throw new ValidationError('symbols must be an array');
    }

    const normalized = symbols
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean);

    if (normalized.length === 0) {
      throw new ValidationError('Basket must include at least 1 symbol');
    }

    if (normalized.length > MAX_BASKET_SYMBOLS) {
      throw new ValidationError(`Basket cannot contain more than ${MAX_BASKET_SYMBOLS} symbols`);
    }

    const unique = [...new Set(normalized)];
    if (unique.length !== normalized.length) {
      throw new ValidationError('Duplicate symbols are not allowed in a basket');
    }

    return unique;
  }

  async validateSymbolsExist(symbols) {
    const available = await prisma.ticker.findMany({
      where: {
        symbol: { in: symbols },
      },
      select: { symbol: true },
    });

    const existing = new Set(available.map((row) => row.symbol.toUpperCase()));
    const missingSymbols = symbols.filter((s) => !existing.has(s.toUpperCase()));

    if (missingSymbols.length > 0) {
      throw new ValidationError(`Unknown symbols: ${missingSymbols.join(', ')}`);
    }
  }

  async getAccessibleBasketGroups(userId) {
    const groups = await prisma.basketGroup.findMany({
      where: {
        OR: [
          { isSystem: true },
          { ownerId: userId },
        ],
      },
      include: {
        symbols: {
          select: { symbol: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      symbolCount: group.symbols.length,
      symbols: group.symbols.map((s) => s.symbol),
      isSystem: group.isSystem,
      isOwner: group.ownerId === userId,
    }));
  }

  async createBasketGroup({ userId, name, description, symbols }) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      throw new ValidationError('Basket name is required');
    }

    const normalizedSymbols = this.normalizeSymbols(symbols);
    await this.validateSymbolsExist(normalizedSymbols);

    const existing = await prisma.basketGroup.findFirst({
      where: {
        ownerId: userId,
        name: normalizedName,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError(`Basket with name "${normalizedName}" already exists`);
    }

    const created = await prisma.basketGroup.create({
      data: {
        name: normalizedName,
        description: description ? String(description).trim() : null,
        ownerId: userId,
        isSystem: false,
        symbols: {
          create: normalizedSymbols.map((symbol, idx) => ({
            symbol,
            position: idx + 1,
          })),
        },
      },
      include: {
        symbols: {
          select: { symbol: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      symbolCount: created.symbols.length,
      symbols: created.symbols.map((s) => s.symbol),
      isSystem: created.isSystem,
      isOwner: true,
    };
  }

  async getEditableUserBasketOrThrow({ userId, basketGroupId }) {
    const group = await prisma.basketGroup.findUnique({
      where: { id: basketGroupId },
      select: {
        id: true,
        ownerId: true,
        isSystem: true,
      },
    });

    if (!group) {
      throw new NotFoundError('Basket group');
    }

    if (group.isSystem) {
      throw new AuthorizationError('System basket cannot be modified');
    }

    if (group.ownerId !== userId) {
      throw new AuthorizationError('You can only modify your own basket');
    }

    return group;
  }

  async updateBasketGroup({ userId, basketGroupId, name, description, symbols }) {
    await this.getEditableUserBasketOrThrow({ userId, basketGroupId });

    const updateData = {};
    let normalizedSymbols = null;

    if (name !== undefined) {
      const normalizedName = String(name || '').trim();
      if (!normalizedName) {
        throw new ValidationError('Basket name cannot be empty');
      }

      const existing = await prisma.basketGroup.findFirst({
        where: {
          ownerId: userId,
          name: normalizedName,
          NOT: { id: basketGroupId },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictError(`Basket with name "${normalizedName}" already exists`);
      }

      updateData.name = normalizedName;
    }

    if (description !== undefined) {
      const normalizedDescription = String(description || '').trim();
      updateData.description = normalizedDescription || null;
    }

    if (symbols !== undefined) {
      normalizedSymbols = this.normalizeSymbols(symbols);
      await this.validateSymbolsExist(normalizedSymbols);
    }

    if (Object.keys(updateData).length === 0 && normalizedSymbols === null) {
      throw new ValidationError('Nothing to update');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.basketGroup.update({
          where: { id: basketGroupId },
          data: updateData,
        });
      }

      if (normalizedSymbols !== null) {
        await tx.basketGroupSymbol.deleteMany({
          where: { basketGroupId },
        });

        await tx.basketGroupSymbol.createMany({
          data: normalizedSymbols.map((symbol, idx) => ({
            basketGroupId,
            symbol,
            position: idx + 1,
          })),
        });
      }

      return tx.basketGroup.findUnique({
        where: { id: basketGroupId },
        include: {
          symbols: {
            select: { symbol: true },
            orderBy: { position: 'asc' },
          },
        },
      });
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      symbolCount: updated.symbols.length,
      symbols: updated.symbols.map((s) => s.symbol),
      isSystem: updated.isSystem,
      isOwner: updated.ownerId === userId,
    };
  }

  async deleteBasketGroup({ userId, basketGroupId }) {
    await this.getEditableUserBasketOrThrow({ userId, basketGroupId });

    await prisma.basketGroup.delete({
      where: { id: basketGroupId },
    });

    return { deleted: true };
  }

  async resolveBasketGroupForUser({ userId, basketGroupId, basketGroup }) {
    let group = null;

    if (basketGroupId) {
      group = await prisma.basketGroup.findFirst({
        where: {
          id: basketGroupId,
          OR: [
            { isSystem: true },
            { ownerId: userId },
          ],
        },
        include: {
          symbols: {
            orderBy: { position: 'asc' },
            select: { symbol: true },
          },
        },
      });
    }

    if (!group && basketGroup) {
      const candidates = await prisma.basketGroup.findMany({
        where: {
          name: basketGroup,
          OR: [
            { isSystem: true },
            { ownerId: userId },
          ],
        },
        include: {
          symbols: {
            orderBy: { position: 'asc' },
            select: { symbol: true },
          },
        },
        orderBy: [
          { ownerId: 'desc' }, // prefer user-owned baskets over system for same name
          { id: 'asc' },
        ],
      });

      group = candidates[0] || null;
    }

    if (!group) {
      throw new NotFoundError('Basket group');
    }

    const symbols = group.symbols.map((s) => String(s.symbol).toUpperCase());

    if (symbols.length === 0) {
      throw new ValidationError('Selected basket has no symbols');
    }

    return { group, symbols };
  }

  async fetchSymbolDailyRows(symbols, startDate, endDate) {
    const tickers = await prisma.ticker.findMany({
      where: { symbol: { in: symbols }, isActive: true },
      select: { id: true, symbol: true },
    });

    const symbolByTickerId = new Map(tickers.map((t) => [t.id, t.symbol]));
    const validTickerIds = tickers.map((t) => t.id);
    const missingSymbols = symbols.filter((s) => !tickers.find((t) => t.symbol === s));

    if (!validTickerIds.length) {
      return { rowsBySymbol: new Map(), missingSymbols, matchedSymbols: [] };
    }

    const rows = await prisma.dailySeasonalityData.findMany({
      where: {
        tickerId: { in: validTickerIds },
        date: {
          gte: toDate(startDate),
          lte: toDate(endDate),
        },
      },
      select: {
        tickerId: true,
        date: true,
        close: true,
        tradingMonthDay: true,
        calendarMonthDay: true,
      },
      orderBy: [{ tickerId: 'asc' }, { date: 'asc' }],
    });

    const rowsBySymbol = new Map();
    rows.forEach((row) => {
      const symbol = symbolByTickerId.get(row.tickerId);
      if (!symbol) return;
      if (!rowsBySymbol.has(symbol)) rowsBySymbol.set(symbol, []);
      rowsBySymbol.get(symbol).push(row);
    });

    return {
      rowsBySymbol,
      missingSymbols,
      matchedSymbols: tickers.map((t) => t.symbol),
    };
  }

  buildCalendarDayRows({
    rowsBySymbol,
    month,
    calendarDay,
    holdingPeriod,
    trendType,
    riskFreeInterestRate,
    topRanks,
    sortFirstBy,
  }) {
    const monthNum = MONTH_SHORT_TO_NUM[month];
    const resultRows = [];

    rowsBySymbol.forEach((rows, symbol) => {
      const years = [...new Set(rows.map((r) => new Date(r.date).getFullYear()))];
      const yearlyReturns = [];

      years.forEach((year) => {
        const filtered = rows.filter((r) => {
          const d = new Date(r.date);
          return d.getFullYear() === year &&
            d.getMonth() + 1 === monthNum &&
            Number(r.calendarMonthDay) >= calendarDay &&
            Number(r.calendarMonthDay) <= (calendarDay + holdingPeriod);
        });

        if (filtered.length > 1) {
          const entryClose = filtered[0].close;
          const exitClose = filtered[filtered.length - 1].close;
          yearlyReturns.push(((exitClose - entryClose) / entryClose) * 100);
        }
      });

      if (!yearlyReturns.length) return;

      const sorted = [...yearlyReturns].sort((a, b) => a - b);
      const avgReturn = yearlyReturns.reduce((sum, v) => sum + v, 0) / yearlyReturns.length;
      const stdDev = computePopulationStd(yearlyReturns, avgReturn);
      const sharpeRatio = stdDev && stdDev !== 0 ? (avgReturn - riskFreeInterestRate) / stdDev : null;
      const winners = yearlyReturns.filter((v) => v > 0).length;
      const losers = yearlyReturns.filter((v) => v < 0).length;
      const winnersPct = (winners * 100) / yearlyReturns.length;
      const losersPct = (losers * 100) / yearlyReturns.length;
      const maxValue = Math.max(...yearlyReturns);
      const minValue = Math.min(...yearlyReturns);

      resultRows.push({
        Symbol: symbol,
        'Annualized Return': safeRound((avgReturn / holdingPeriod) * 365),
        'Avg Return': safeRound(avgReturn),
        'Median Return': safeRound(median(sorted)),
        'Max Gain': maxValue < 0 ? null : safeRound(maxValue),
        'Max Loss': minValue > 0 ? null : safeRound(minValue),
        'Total Trades': yearlyReturns.length,
        Winners: winners,
        'Winners %': safeRound(winnersPct),
        Losers: losers,
        'Losers %': safeRound(losersPct),
        'Std Dev': safeRound(stdDev),
        'Sharpe Ratio': safeRound(sharpeRatio),
      });
    });

    const baseSort = sortFirstBy === 'WinnerPct'
      ? [{ key: 'Winners %', dir: 'desc' }, { key: 'Avg Return', dir: 'desc' }, { key: 'Std Dev', dir: 'asc' }]
      : [{ key: 'Avg Return', dir: 'desc' }, { key: 'Winners %', dir: 'desc' }, { key: 'Std Dev', dir: 'asc' }];

    let filtered = [...resultRows];
    if (trendType === 'Bullish') {
      filtered = filtered.filter((r) => Number(r['Avg Return']) > 0);
      filtered.sort((a, b) => this.multiSort(a, b, baseSort));
    } else if (trendType === 'Bearish') {
      filtered = filtered.filter((r) => Number(r['Avg Return']) < 0);
      const bearishSort = sortFirstBy === 'WinnerPct'
        ? [{ key: 'Winners %', dir: 'asc' }, { key: 'Avg Return', dir: 'asc' }, { key: 'Std Dev', dir: 'desc' }]
        : [{ key: 'Avg Return', dir: 'asc' }, { key: 'Winners %', dir: 'asc' }, { key: 'Std Dev', dir: 'desc' }];
      filtered.sort((a, b) => this.multiSort(a, b, bearishSort));
    } else {
      filtered.sort((a, b) => this.multiSort(a, b, baseSort));
    }

    filtered = filtered.map((row, idx) => ({
      Rank: idx + 1,
      ...row,
      'Winners %': row['Winners %'] !== null ? Number(row['Winners %']).toFixed(2) : null,
      'Losers %': row['Losers %'] !== null ? Number(row['Losers %']).toFixed(2) : null,
    }));

    if (topRanks > 0) {
      filtered = filtered.slice(0, topRanks);
    }

    return filtered;
  }

  buildTradingDayRows({
    rowsBySymbol,
    month,
    tradingDay,
    holdingPeriod,
    trendType,
    riskFreeInterestRate,
    topRanks,
    sortFirstBy,
  }) {
    const monthNum = MONTH_SHORT_TO_NUM[month];
    const resultRows = [];

    rowsBySymbol.forEach((rows, symbol) => {
      const years = [...new Set(rows.map((r) => new Date(r.date).getFullYear()))];
      const yearlyReturns = [];

      years.forEach((year) => {
        const filtered = rows.filter((r) => {
          const d = new Date(r.date);
          return d.getFullYear() === year &&
            d.getMonth() + 1 === monthNum &&
            Number(r.tradingMonthDay) >= tradingDay &&
            Number(r.tradingMonthDay) <= (tradingDay + holdingPeriod);
        });

        // Keep old logic exactly: require len(filtered) > holdingPeriod
        if (filtered.length > holdingPeriod) {
          const entryClose = filtered[0].close;
          const exitClose = filtered[filtered.length - 1].close;
          yearlyReturns.push(((exitClose - entryClose) / entryClose) * 100);
        }
      });

      if (!yearlyReturns.length) return;

      const sorted = [...yearlyReturns].sort((a, b) => a - b);
      const avgReturn = yearlyReturns.reduce((sum, v) => sum + v, 0) / yearlyReturns.length;
      const stdDev = computePopulationStd(yearlyReturns, avgReturn);
      const sharpeRatio = stdDev && stdDev !== 0 ? (avgReturn - riskFreeInterestRate) / stdDev : null;
      const winners = yearlyReturns.filter((v) => v > 0).length;
      const losers = yearlyReturns.filter((v) => v < 0).length;
      const winnersPct = (winners * 100) / yearlyReturns.length;
      const losersPct = (losers * 100) / yearlyReturns.length;
      const maxValue = Math.max(...yearlyReturns);
      const minValue = Math.min(...yearlyReturns);

      resultRows.push({
        Symbol: symbol,
        'Annualized Return': safeRound((avgReturn / holdingPeriod) * 365),
        'Avg Return': safeRound(avgReturn),
        'Median Return': safeRound(median(sorted)),
        'Max Gain': maxValue < 0 ? null : safeRound(maxValue),
        'Max Loss': minValue > 0 ? null : safeRound(minValue),
        'Total Trades': yearlyReturns.length,
        Winners: winners,
        'Winners %': safeRound(winnersPct),
        Losers: losers,
        'Losers %': safeRound(losersPct),
        'Std Dev': safeRound(stdDev),
        'Sharpe Ratio': safeRound(sharpeRatio),
      });
    });

    const baseSort = sortFirstBy === 'WinnerPct'
      ? [{ key: 'Winners %', dir: 'desc' }, { key: 'Avg Return', dir: 'desc' }, { key: 'Std Dev', dir: 'asc' }]
      : [{ key: 'Avg Return', dir: 'desc' }, { key: 'Winners %', dir: 'desc' }, { key: 'Std Dev', dir: 'asc' }];

    let filtered = [...resultRows];
    if (trendType === 'Bullish') {
      filtered = filtered.filter((r) => Number(r['Avg Return']) > 0);
      // Keep old trading-day quirk: bullish sorts Std Dev descending in final step
      const bullishSort = sortFirstBy === 'WinnerPct'
        ? [{ key: 'Winners %', dir: 'desc' }, { key: 'Avg Return', dir: 'desc' }, { key: 'Std Dev', dir: 'desc' }]
        : [{ key: 'Avg Return', dir: 'desc' }, { key: 'Winners %', dir: 'desc' }, { key: 'Std Dev', dir: 'desc' }];
      filtered.sort((a, b) => this.multiSort(a, b, bullishSort));
    } else if (trendType === 'Bearish') {
      filtered = filtered.filter((r) => Number(r['Avg Return']) < 0);
      const bearishSort = sortFirstBy === 'WinnerPct'
        ? [{ key: 'Winners %', dir: 'asc' }, { key: 'Avg Return', dir: 'asc' }, { key: 'Std Dev', dir: 'desc' }]
        : [{ key: 'Avg Return', dir: 'asc' }, { key: 'Winners %', dir: 'asc' }, { key: 'Std Dev', dir: 'desc' }];
      filtered.sort((a, b) => this.multiSort(a, b, bearishSort));
    } else {
      filtered.sort((a, b) => this.multiSort(a, b, baseSort));
    }

    filtered = filtered.map((row, idx) => ({
      Rank: idx + 1,
      ...row,
      'Winners %': row['Winners %'] !== null ? Number(row['Winners %']).toFixed(2) : null,
      'Losers %': row['Losers %'] !== null ? Number(row['Losers %']).toFixed(2) : null,
    }));

    if (topRanks > 0) {
      filtered = filtered.slice(0, topRanks);
    }

    return filtered;
  }

  buildBestMonthlyRows({
    rowsBySymbol,
    monthName,
    rankType,
    intervalGapRange,
    totalReturns,
  }) {
    const monthNum = MONTH_UPPER_TO_NUM[monthName];
    let allRows = [];

    rowsBySymbol.forEach((rows, symbol) => {
      const monthlyRows = rows
        .filter((r) => (new Date(r.date).getMonth() + 1) === monthNum)
        .map((r) => ({
          date: r.date,
          close: r.close,
          tradingMonthDay: Number(r.tradingMonthDay),
        }))
        .filter((r) => Number.isFinite(r.tradingMonthDay));

      if (!monthlyRows.length) return;

      for (let i = intervalGapRange; i < monthlyRows.length; i++) {
        const current = monthlyRows[i];
        const previous = monthlyRows[i - intervalGapRange];
        const avgReturn = ((current.close - previous.close) / previous.close) * 100;
        const startDay = previous.tradingMonthDay;
        const endDay = current.tradingMonthDay;

        if (!(endDay > startDay)) continue;

        allRows.push({
          TickerName: symbol,
          'Start Day': startDay,
          'End Day': endDay,
          avgReturn,
        });
      }
    });

    if (!allRows.length) return [];

    const grouped = new Map();
    allRows.forEach((row) => {
      const key = `${row.TickerName}|${row['Start Day']}|${row['End Day']}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row.avgReturn);
    });

    const reduced = [];
    grouped.forEach((values, key) => {
      const [ticker, startDayStr, endDayStr] = key.split('|');
      const positives = values.filter((v) => v > 0);
      const negatives = values.filter((v) => v < 0);
      reduced.push({
        TickerName: ticker,
        'Start Day': Number(startDayStr),
        'End Day': Number(endDayStr),
        'Avg Return': safeRound(values.reduce((sum, v) => sum + v, 0) / values.length),
        'Pos Avg Return': positives.length ? safeRound(positives.reduce((sum, v) => sum + v, 0) / positives.length) : null,
        'Neg Avg Return': negatives.length ? safeRound(negatives.reduce((sum, v) => sum + v, 0) / negatives.length) : null,
        'Pos Count': positives.length,
        'Neg Count': negatives.length,
      });
    });

    const sorted = [...reduced].sort((a, b) => {
      if (rankType === 'Bullish') return Number(b['Avg Return']) - Number(a['Avg Return']);
      return Number(a['Avg Return']) - Number(b['Avg Return']);
    });
    const limited = sorted.slice(0, totalReturns);

    return limited.map((row, idx) => ({
      'Rank No': idx + 1,
      ...row,
    }));
  }

  multiSort(a, b, sorts) {
    for (const sort of sorts) {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = av === null || av === undefined ? Number.POSITIVE_INFINITY : Number(av);
      const bn = bv === null || bv === undefined ? Number.POSITIVE_INFINITY : Number(bv);
      if (an === bn) continue;
      if (sort.dir === 'asc') return an - bn;
      return bn - an;
    }
    return String(a.Symbol || '').localeCompare(String(b.Symbol || ''));
  }

  async calendarDayAnalysis(params) {
    const {
      userId,
      basketGroup,
      basketGroupId,
      startDate,
      endDate,
      month,
      calendarDay = 10,
      holdingPeriod = 10,
      trendType = 'Any',
      riskFreeInterestRate = 7,
      topRanks = 10,
      sortFirstBy = 'AvgPnl',
    } = params;

    const { group, symbols } = await this.resolveBasketGroupForUser({
      userId,
      basketGroup,
      basketGroupId: basketGroupId ? Number(basketGroupId) : null,
    });

    const { rowsBySymbol, missingSymbols, matchedSymbols } = await this.fetchSymbolDailyRows(symbols, startDate, endDate);
    const rows = this.buildCalendarDayRows({
      rowsBySymbol,
      month,
      calendarDay: Number(calendarDay),
      holdingPeriod: Number(holdingPeriod),
      trendType,
      riskFreeInterestRate: Number(riskFreeInterestRate),
      topRanks: Number(topRanks),
      sortFirstBy,
    });

    return {
      basketGroupId: group.id,
      basketGroup: group.name,
      month,
      rows,
      meta: {
        requestedSymbols: symbols.length,
        matchedSymbols: matchedSymbols.length,
        missingSymbols,
      },
    };
  }

  async tradingDayAnalysis(params) {
    const {
      userId,
      basketGroup,
      basketGroupId,
      startDate,
      endDate,
      month,
      tradingDay = 10,
      holdingPeriod = 10,
      trendType = 'Any',
      riskFreeInterestRate = 7,
      topRanks = 10,
      sortFirstBy = 'AvgPnl',
    } = params;

    const { group, symbols } = await this.resolveBasketGroupForUser({
      userId,
      basketGroup,
      basketGroupId: basketGroupId ? Number(basketGroupId) : null,
    });

    const { rowsBySymbol, missingSymbols, matchedSymbols } = await this.fetchSymbolDailyRows(symbols, startDate, endDate);
    const rows = this.buildTradingDayRows({
      rowsBySymbol,
      month,
      tradingDay: Number(tradingDay),
      holdingPeriod: Number(holdingPeriod),
      trendType,
      riskFreeInterestRate: Number(riskFreeInterestRate),
      topRanks: Number(topRanks),
      sortFirstBy,
    });

    return {
      basketGroupId: group.id,
      basketGroup: group.name,
      month,
      rows,
      meta: {
        requestedSymbols: symbols.length,
        matchedSymbols: matchedSymbols.length,
        missingSymbols,
      },
    };
  }

  async bestMonthlyReturns(params) {
    const {
      userId,
      basketGroup,
      basketGroupId,
      monthName,
      rankType = 'Bullish',
      startDate,
      endDate,
      intervalGapRange = 10,
      totalReturns = 2,
    } = params;

    const { group, symbols } = await this.resolveBasketGroupForUser({
      userId,
      basketGroup,
      basketGroupId: basketGroupId ? Number(basketGroupId) : null,
    });

    const { rowsBySymbol, missingSymbols, matchedSymbols } = await this.fetchSymbolDailyRows(symbols, startDate, endDate);
    const rows = this.buildBestMonthlyRows({
      rowsBySymbol,
      monthName,
      rankType,
      intervalGapRange: Number(intervalGapRange),
      totalReturns: Number(totalReturns),
    });

    return {
      basketGroupId: group.id,
      basketGroup: group.name,
      monthName,
      rankType,
      rows,
      meta: {
        requestedSymbols: symbols.length,
        matchedSymbols: matchedSymbols.length,
        missingSymbols,
      },
    };
  }
}

module.exports = new BasketAnalysisService();
