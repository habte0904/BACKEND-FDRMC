export const validateOrganization = (data) => {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Name is required and must be a non-empty string.');
    }

    if (!data.type || typeof data.type !== 'string' || data.type.trim() === '') {
        errors.push('Type is required (head_office | branch | subcity | woreda).');
    }

    const allowedTypes = ['head_office', 'branch', 'subcity', 'woreda'];
    if (data.type && !allowedTypes.includes(data.type)) {
        errors.push(`Type must be one of: ${allowedTypes.join(', ')}`);
    }

    if (data.type === 'branch' && !data.subcity) {
        errors.push('Subcity is required when creating a branch organization.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const transformOrganizationInput = (data) => {
    return {
        ...data,
        name: data.name ? data.name.trim() : data.name,
        type: data.type ? data.type.trim().toLowerCase() : data.type,
        branchCode: data.branchCode ? data.branchCode.trim().toUpperCase() : data.branchCode,
        phone: data.phone ? data.phone.trim() : data.phone,
        email: data.email ? data.email.trim() : data.email,
        address: data.address ? data.address.trim() : data.address,
        description: data.description ? data.description.trim() : data.description,
        subcity: data.subcity || null
    };
};

export const formatOrganizationResponse = (organization) => {
    if (!organization) return null;
    return {
        id: organization._id,
        _id: organization._id,
        name: organization.name,
        type: organization.type,
        parentId: organization.parentId,
        subcity: organization.subcity,
        subcityName: organization.subcityName || (organization.subcity && typeof organization.subcity === 'object' ? organization.subcity.name : undefined),
        branchCode: organization.branchCode,
        headOffice: organization.headOffice,
        phone: organization.phone,
        email: organization.email,
        address: organization.address,
        description: organization.description,
        status: organization.status || 'active',
        woredasCount: organization.woredasCount ?? 0,
        woredas: organization.woredas || [],
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
    };
};

