/**
 * =============================================================================
 * AUTH CONTROLLER (Refactored - Separation of Concerns)
 * =============================================================================
 * Following Single Responsibility - Auth logic separated from routes
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const UserEntity = require('../../domain/entities/User');
const { AppError, ValidationError, NotFoundError, UnauthorizedError } = require('../../shared/errors/AppError');

class AuthController {
    async register(req, res, next) {
        try {
            const { username, password } = req.body;

            // Check if user exists
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                throw new ConflictError('Nome de usuário já está em uso');
            }

            // Hash password
            const hashedPassword = bcrypt.hashSync(password, 10);

            // Create user
            const user = await User.create({
                username,
                password: hashedPassword
            });

            const userEntity = new UserEntity(user.toObject());

            res.status(201).json({
                message: 'Usuário registrado com sucesso',
                userId: user._id,
                user: userEntity.toJSON()
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { username, password } = req.body;

            const user = await User.findOne({ username });
            if (!user) {
                throw new NotFoundError('Usuário');
            }

            const isValidPassword = bcrypt.compareSync(password, user.password);
            if (!isValidPassword) {
                throw new UnauthorizedError('Senha inválida');
            }

            const userEntity = new UserEntity(user.toObject());

            const token = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET || 'supersecretkey_change_me',
                { expiresIn: '24h' }
            );

            res.status(200).json({
                auth: true,
                token,
                username: userEntity.username,
                subscriptionStatus: userEntity.subscriptionStatus,
                user: userEntity.toJSON()
            });
        } catch (error) {
            next(error);
        }
    }

    async getMe(req, res, next) {
        try {
            const user = await User.findById(req.userId).select('-password');
            if (!user) {
                throw new NotFoundError('Usuário');
            }

            const userEntity = new UserEntity(user.toObject());
            res.json(userEntity.toJSON());
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();