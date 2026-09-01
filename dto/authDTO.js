export const validateRegister = (data) => {
    const errors = [];
    if (!data.fullname || data.fullname.trim() === '') errors.push('Full name is required.');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) errors.push('Valid email is required.');

    // Password is generated from backend DEFAULT_PASSWORD if not provided
    if (data.password && data.password.length < 6) errors.push('Password must be at least 6 characters.');

    return { isValid: errors.length === 0, errors };
};

export const validateLogin = (data) => {
    const errors = [];
    if (!data.email || data.email.trim() === '') errors.push('Email is required.');
    if (!data.password || data.password === '') errors.push('Password is required.');
    return { isValid: errors.length === 0, errors };
};

export const transformRegisterInput = (data) => {
    const transformed = {
        ...data,
        fullname: data.fullname?.trim(),
        email: data.email?.trim().toLowerCase()
    };

    if (!transformed.phone || transformed.phone.trim() === '') {
        delete transformed.phone;
    } else {
        transformed.phone = transformed.phone.trim();
    }

    return transformed;
};

export const transformLoginInput = (data) => {
    return {
        ...data,
        email: data.email?.trim().toLowerCase()
    };
};
