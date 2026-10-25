const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must contain at least 2 characters').max(120),
    email: z.string().email('Please enter a valid email address').transform((v) => v.toLowerCase().trim()),
    password: z.string().min(10, 'Password must contain at least 10 characters').max(128),
    role: z.enum(['admin', 'employee']).default('employee'),
    department: z.string().max(120).optional(),
    employeeId: z.string().max(60).optional(),
  }),
  params: z.any().optional(),
  query: z.any().optional(),
});

const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must contain at least 2 characters').max(120).optional(),
    department: z.string().max(120).optional(),
    employeeId: z.string().max(60).optional(),
    role: z.enum(['admin', 'employee']).optional(),
  }),
  params: z.object({ id: objectId }),
  query: z.any().optional(),
});

const statusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
  params: z.object({ id: objectId }),
  query: z.any().optional(),
});

const idParamSchema = z.object({
  body: z.any().optional(),
  params: z.object({ id: objectId }),
  query: z.any().optional(),
});

module.exports = { createUserSchema, updateUserSchema, statusSchema, idParamSchema, objectId };
