class APIFeatures {
    /**
     * Create APIFeatures instance
     * @param {Object} query - Mongoose query object
     * @param {Object} queryString - Request query parameters
     */
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    /**
     * Filter the query based on query parameters
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    filter() {
        // 1A) Filtering
        const queryObj = { ...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach(el => delete queryObj[el]);

        // 1B) Advanced filtering (gt, gte, lt, lte, in)
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in)\b/g, match => `$${match}`);

        this.query = this.query.find(JSON.parse(queryStr));

        return this;
    }

    /**
     * Sort the query results
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('-createdAt');
        }

        return this;
    }

    /**
     * Limit the fields to return
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }

        return this;
    }

    /**
     * Apply pagination to the query
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    paginate() {
        const page = this.queryString.page * 1 || 1;
        const limit = this.queryString.limit * 1 || 100;
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);

        return this;
    }

    /**
     * Apply text search on specified fields
     * @param {string[]} fields - Array of field names to search in
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    search(fields = []) {
        if (this.queryString.q && fields.length > 0) {
            const searchQuery = {
                $or: fields.map(field => ({
                    [field]: { $regex: this.queryString.q, $options: 'i' }
                }))
            };
            this.query = this.query.find(searchQuery);
        }

        return this;
    }

    /**
     * Populate referenced documents
     * @param {Array} populateOptions - Array of population options
     * @returns {APIFeatures} - Returns the APIFeatures instance for chaining
     */
    populate(populateOptions = []) {
        if (populateOptions.length > 0) {
            populateOptions.forEach(option => {
                this.query = this.query.populate(option);
            });
        }

        return this;
    }

    /**
     * Execute the query and return the results
     * @returns {Promise<Object>} - Returns the query results
     */
    async execute() {
        return await this.query;
    }

    /**
     * Get pagination metadata
     * @param {number} total - Total number of documents
     * @returns {Object} - Pagination metadata
     */
    getPagination(total) {
        const page = this.queryString.page * 1 || 1;
        const limit = this.queryString.limit * 1 || 100;
        const pages = Math.ceil(total / limit);

        return {
            total,
            page,
            limit,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1
        };
    }
}

module.exports = APIFeatures;
