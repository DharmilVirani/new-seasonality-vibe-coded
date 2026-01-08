/**
 * CSV Service - Handles CSV parsing, validation, and transformation
 *
 * Dependencies:
 * npm install papaparse
 */

const Papa = require('papaparse')

class CsvService {
    /**
     * Normalize a single header string
     * Removes whitespace and converts to lowercase
     * @param {string} header - Original column header
     * @returns {string} Normalized header
     */
    normalizeHeader(header) {
        if (!header || typeof header !== 'string') {
            return ''
        }
        return header.trim().toLowerCase().replace(/\s+/g, '')
    }

    /**
     * Normalize all record keys in an array
     * @param {Array} records - Parsed CSV records with original headers
     * @returns {Array} Records with normalized keys
     */
    normalizeRecordKeys(records) {
        return records.map((record) => {
            const normalized = {}
            Object.keys(record).forEach((key) => {
                const normalizedKey = this.normalizeHeader(key)
                normalized[normalizedKey] = record[key]
            })
            return normalized
        })
    }

    /**
     * Validate that all required columns are present
     * @param {string[]} headers - Normalized headers array
     * @throws {Error} If required columns are missing
     */
    validateRequiredColumns(headers) {
        const requiredColumns = ['date', 'ticker', 'close']
        const missingColumns = requiredColumns.filter((col) => !headers.includes(col))

        if (missingColumns.length > 0) {
            throw new Error(
                `Column name not valid. Missing required columns: ${missingColumns.join(', ')}. ` +
                    `Required columns are: ${requiredColumns.join(', ')}`
            )
        }
    }

    /**
     * Parse CSV file content using Papaparse
     * @param {Buffer} fileBuffer - CSV file buffer from multer
     * @returns {Array} Parsed CSV records with normalized headers
     * @throws {Error} If parsing fails or file is empty
     */
    parseCsv(fileBuffer) {
        try {
            const csvContent = fileBuffer.toString('utf8')

            // Papaparse configuration for robust parsing
            const result = Papa.parse(csvContent, {
                header: true, // First row is headers
                skipEmptyLines: true, // Skip empty lines
                dynamicTyping: false, // Keep as strings for validation
                trimHeaders: true, // Trim whitespace from headers
                transformHeader: (header) => this.normalizeHeader(header), // Normalize headers
                delimitersToGuess: [',', '\t', '|', ';'], // Auto-detect delimiter
                skipFirstNLines: 0,
                comments: false,
            })

            // Check for parsing errors
            if (result.errors.length > 0) {
                const errorMessages = result.errors
                    .slice(0, 5) // Show first 5 errors
                    .map((err) => `Row ${err.row + 2}: ${err.message}`)
                    .join('\n')
                throw new Error(`CSV parsing errors:\n${errorMessages}`)
            }

            // Check if data exists
            if (!result.data || result.data.length === 0) {
                throw new Error('CSV file is empty or contains no valid data rows')
            }

            return result.data
        } catch (error) {
            if (error.message.includes('CSV parsing errors') || error.message.includes('CSV file is empty')) {
                throw error
            }
            throw new Error(`Failed to parse CSV: ${error.message}`)
        }
    }

    /**
     * Check if a date string contains time information
     * @param {string} dateString - Date string to check
     * @returns {boolean} True if datetime, false if date only
     */
    isDateTime(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return false
        }

        const trimmed = dateString.trim()

        // Check for time patterns
        // Matches: "2024-01-15 10:30:00", "2024-01-15T10:30:00", "01/15/2024 10:30:00"
        const dateTimePatterns = [
            /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/, // ISO datetime
            /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/, // US datetime
            /\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}/, // DD-MM-YYYY datetime
        ]

        return dateTimePatterns.some((pattern) => pattern.test(trimmed))
    }

    /**
     * Convert date to DD/MM/YYYY format
     * @param {Date} date - Date object to format
     * @returns {string} Date in DD/MM/YYYY format
     */
    formatDateToDDMMYYYY(date) {
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
    }

    /**
     * Parse date string and handle multiple formats
     * @param {string} dateString - Date string to parse
     * @returns {Date|null} Parsed date or null if invalid
     */
    parseDate(dateString) {
        const trimmed = dateString.trim()

        // Try DD-MM-YYYY format (18-07-2005)
        const ddmmyyyyPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
        const ddmmyyyyMatch = trimmed.match(ddmmyyyyPattern)
        if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch
            const date = new Date(year, month - 1, day)
            // Validate the date is correct (handles invalid dates like 32-13-2005)
            if (date.getDate() == day && date.getMonth() == month - 1 && date.getFullYear() == year) {
                return date
            }
        }

        // Try DD/MM/YYYY format (18/07/2005)
        const ddmmyyyySlashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        const ddmmyyyySlashMatch = trimmed.match(ddmmyyyySlashPattern)
        if (ddmmyyyySlashMatch) {
            const [, day, month, year] = ddmmyyyySlashMatch
            const date = new Date(year, month - 1, day)
            if (date.getDate() == day && date.getMonth() == month - 1 && date.getFullYear() == year) {
                return date
            }
        }

        // Try native Date parsing for other formats (YYYY-MM-DD, MM/DD/YYYY, ISO datetime, etc.)
        const date = new Date(trimmed)
        if (!isNaN(date.getTime())) {
            return date
        }

        return null
    }

    /**
     * Validate and parse date string
     * @param {string} dateString - Date string to validate
     * @param {number} rowIndex - Row index for error reporting (0-based)
     * @returns {Object} Object with date and formatted string
     * @throws {Error} If date is invalid
     */
    validateDate(dateString, rowIndex) {
        if (!dateString || dateString.trim() === '') {
            throw new Error(`Row ${rowIndex + 1}: Date cannot be empty`)
        }

        // Check if it's a datetime and extract date part if needed
        const isDateTimeValue = this.isDateTime(dateString)

        // Parse the date using multiple format support
        const date = this.parseDate(dateString)

        if (!date) {
            throw new Error(
                `Row ${rowIndex + 1}: Invalid date format: "${dateString}". ` +
                    `Expected formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or MM/DD/YYYY`
            )
        }

        // Check for reasonable date range (e.g., not in distant future)
        const now = new Date()
        const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate())
        if (date > tenYearsFromNow) {
            throw new Error(`Row ${rowIndex + 1}: Date "${dateString}" is too far in the future`)
        }

        // Convert to DD/MM/YYYY format
        const formattedDate = this.formatDateToDDMMYYYY(date)

        return {
            date,
            formattedDate,
            wasDateTime: isDateTimeValue,
        }
    }

    /**
     * Validate and parse numeric field
     * @param {any} value - Value to validate
     * @param {string} fieldName - Field name for error reporting
     * @param {number} rowIndex - Row index for error reporting (0-based)
     * @param {boolean} required - Whether field is required
     * @returns {number|null} Parsed number or null
     * @throws {Error} If required field is missing or value is not numeric
     */
    validateNumber(value, fieldName, rowIndex, required = false) {
        // Handle empty values
        if (value === null || value === undefined || value === '') {
            if (required) {
                throw new Error(`Row ${rowIndex + 1}: ${fieldName} is required and cannot be empty`)
            }
            return null
        }

        // Convert to string and trim
        const stringValue = String(value).trim()

        // Parse to float
        const parsed = parseFloat(stringValue)

        if (isNaN(parsed)) {
            throw new Error(`Row ${rowIndex + 1}: ${fieldName} must be a valid number, got "${value}"`)
        }

        // Check for negative values in fields that shouldn't be negative
        if (['volume', 'openinterest'].includes(fieldName.toLowerCase()) && parsed < 0) {
            throw new Error(`Row ${rowIndex + 1}: ${fieldName} cannot be negative, got ${parsed}`)
        }

        return parsed
    }

    /**
     * Sanitize ticker symbol
     * Converts to uppercase and removes invalid characters
     * @param {string} ticker - Ticker symbol to sanitize
     * @returns {string} Sanitized ticker symbol
     */
    sanitizeTicker(ticker) {
        if (!ticker || typeof ticker !== 'string') {
            return ''
        }
        // Allow letters, numbers, hyphens, and dots only
        return ticker
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9\-\.]/g, '')
    }

    /**
     * Validate data types and transform records
     * Applies all business rules and validations
     * @param {Array} records - Records to validate
     * @returns {Array} Validated and transformed records
     * @throws {Error} If validation fails
     */
    validateAndTransformRecords(records) {
        const errors = []
        const validated = []
        const warnings = []
        let dateTimeCount = 0

        records.forEach((record, index) => {
            try {
                // Step 1: Validate and transform date
                const dateResult = this.validateDate(record.date, index)
                const { date, formattedDate, wasDateTime } = dateResult

                if (wasDateTime) {
                    dateTimeCount++
                }

                // Step 2: Validate and sanitize ticker
                const ticker = this.sanitizeTicker(record.ticker)
                if (!ticker) {
                    throw new Error(`Row ${index + 1}: Ticker cannot be empty or invalid`)
                }

                // Step 3: Validate close price (required)
                const close = this.validateNumber(record.close, 'Close', index, true)
                if (close <= 0) {
                    throw new Error(`Row ${index + 1}: Close price must be greater than 0, got ${close}`)
                }

                // Step 4: Validate open price (use close if missing)
                let open = this.validateNumber(record.open, 'Open', index, false)
                if (open === null) {
                    open = close
                    warnings.push(`Row ${index + 1}: Open price was empty, using Close price (${close})`)
                }

                // Step 5: Validate high price (optional)
                const high = this.validateNumber(record.high, 'High', index, false)

                // Step 6: Validate low price (optional)
                const low = this.validateNumber(record.low, 'Low', index, false)

                // Step 7: Validate volume (default to 0 if missing)
                let volume = this.validateNumber(record.volume, 'Volume', index, false)
                if (volume === null) {
                    volume = 0
                }

                // Step 8: Validate openInterest (default to 0 if missing)
                let openInterest = this.validateNumber(record.openinterest, 'OpenInterest', index, false)
                if (openInterest === null) {
                    openInterest = 0
                }

                // Add validated record
                validated.push({
                    date,
                    dateFormatted: formattedDate, // DD/MM/YYYY format
                    ticker,
                    open,
                    high,
                    low,
                    close,
                    volume,
                    openInterest,
                    rowIndex: index + 1, // For tracking original row
                })
            } catch (error) {
                errors.push(error.message)
            }
        })

        // Add info message if datetime values were detected and converted
        if (dateTimeCount > 0) {
            warnings.unshift(`Detected ${dateTimeCount} datetime value(s) - converted to DD/MM/YYYY format`)
        }

        // If there are validation errors, throw them all
        if (errors.length > 0) {
            const errorMessage =
                errors.length > 10
                    ? `${errors.slice(0, 10).join('\n')}\n... and ${errors.length - 10} more errors`
                    : errors.join('\n')
            throw new Error(`Data validation failed:\n${errorMessage}`)
        }

        return { validated, warnings }
    }

    /**
     * Complete CSV validation and processing pipeline
     * @param {Buffer} fileBuffer - CSV file buffer from multer
     * @returns {Object} Validated records and warnings
     * @throws {Error} If any validation step fails
     */
    processCSV(fileBuffer) {
        // Step 1: Parse CSV with Papaparse
        const records = this.parseCsv(fileBuffer)

        // Step 2: Validate required columns are present
        const headers = Object.keys(records[0])
        this.validateRequiredColumns(headers)

        // Step 3: Validate data types and transform records
        const { validated, warnings } = this.validateAndTransformRecords(records)

        return {
            records: validated,
            warnings: warnings.length > 0 ? warnings : null,
        }
    }
}

module.exports = new CsvService()
