/**
 * Special Days Routes
 * Provides endpoints for fetching special days (festivals, holidays, events)
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * GET /api/special-days
 * Get all unique special day names
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const specialDays = await prisma.specialDay.findMany({
      distinct: ['name'],
      select: {
        name: true,
        category: true,
        country: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: specialDays,
      count: specialDays.length,
    });
  } catch (error) {
    console.error('Error fetching special days:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special days',
    });
  }
});

/**
 * GET /api/special-days/by-year/:year
 * Get special days for a specific year
 */
router.get('/by-year/:year', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.params.year);

    if (isNaN(year)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter',
      });
    }

    const specialDays = await prisma.specialDay.findMany({
      where: {
        year: year,
      },
      orderBy: {
        date: 'asc',
      },
    });

    res.json({
      success: true,
      data: specialDays,
      count: specialDays.length,
      year: year,
    });
  } catch (error) {
    console.error('Error fetching special days by year:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special days',
    });
  }
});

/**
 * GET /api/special-days/by-name/:name
 * Get all occurrences of a specific special day across years
 */
router.get('/by-name/:name', authenticateToken, async (req, res) => {
  try {
    const name = req.params.name.toUpperCase();

    const specialDays = await prisma.specialDay.findMany({
      where: {
        name: name,
      },
      orderBy: {
        date: 'asc',
      },
    });

    res.json({
      success: true,
      data: specialDays,
      count: specialDays.length,
      name: name,
    });
  } catch (error) {
    console.error('Error fetching special days by name:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special days',
    });
  }
});

/**
 * GET /api/special-days/categories
 * Get all special day categories
 */
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.specialDay.groupBy({
      by: ['category', 'country'],
      _count: true,
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching special day categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

/**
 * GET /api/special-days/date-range
 * Get special days within a date range
 */
router.get('/date-range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, names } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const whereClause = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    // Filter by specific special day names if provided
    if (names) {
      const nameArray = Array.isArray(names) ? names : [names];
      whereClause.name = {
        in: nameArray.map(n => n.toUpperCase()),
      };
    }

    const specialDays = await prisma.specialDay.findMany({
      where: whereClause,
      orderBy: {
        date: 'asc',
      },
    });

    res.json({
      success: true,
      data: specialDays,
      count: specialDays.length,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error('Error fetching special days by date range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch special days',
    });
  }
});

module.exports = router;
