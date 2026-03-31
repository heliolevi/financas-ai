/**
 * =============================================================================
 * BASE REPOSITORY (Generic Repository Pattern)
 * =============================================================================
 * Following DRY and Repository Pattern - common CRUD operations
 */

class BaseRepository {
    constructor(model) {
        this.model = model;
    }

    async findAll(filter = {}, options = {}) {
        const { limit = 100, skip = 0, sort = { createdAt: -1 } } = options;
        return this.model.find(filter).sort(sort).skip(skip).limit(limit);
    }

    async findById(id) {
        return this.model.findById(id);
    }

    async findOne(filter) {
        return this.model.findOne(filter);
    }

    async create(data) {
        return this.model.create(data);
    }

    async update(id, data) {
        return this.model.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return this.model.findByIdAndDelete(id);
    }

    async count(filter = {}) {
        return this.model.countDocuments(filter);
    }

    async findByIdAndUpdate(id, updateData, options = {}) {
        return this.model.findByIdAndUpdate(id, updateData, { 
            new: true,
            runValidators: true,
            ...options 
        });
    }

    async aggregate(pipeline) {
        return this.model.aggregate(pipeline);
    }
}

module.exports = BaseRepository;