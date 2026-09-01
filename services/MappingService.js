/**
 * Utility to set a value at a nested path in an object
 * @param {Object} obj The object to modify
 * @param {String} path The dot-separated path (e.g., 'a.b.c')
 * @param {Any} value The value to set
 */
const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
};

/**
 * Helper to extract value from potentially structured answer
 */
const getRawValue = (val) => {
    if (typeof val === 'object' && val !== null && 'value' in val) {
        return val.value;
    }
    return val;
};

/**
 * Validates data against mapping configuration
 * @param {Object} data Source data
 * @param {Object} mappingConfig ProfileMapping object
 * @returns {Array} List of validation errors
 */
export const validateData = (data, mappingConfig) => {
    const errors = [];
    mappingConfig.mappings.forEach(mapping => {
        const value = getRawValue(data[mapping.sourceKey]);
        
        // Check required
        if (mapping.validation?.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field: mapping.targetFieldPath,
                message: `Source key '${mapping.sourceKey}' is required but missing.`
            });
        }

        // Check types if value exists
        if (value !== undefined && value !== null && value !== '') {
            const type = mapping.validation?.type;
            if (type === 'number' && isNaN(Number(value))) {
                errors.push({
                    field: mapping.targetFieldPath,
                    message: `Value '${value}' is not a valid number.`
                });
            }
            // Add more type checks as needed
        }
    });
    return errors;
};

/**
 * Transforms source data into WoredaProfile structure based on mapping
 * @param {Object} sourceData Source data (FormResponse answers or Excel row)
 * @param {Object} mappingConfig ProfileMapping object
 * @returns {Object} Transformed data object
 */
export const transformData = (sourceData, mappingConfig) => {
    const result = { data: {}, metadata: {} };
    
    mappingConfig.mappings.forEach(mapping => {
        const rawAnswer = sourceData[mapping.sourceKey];
        let value = getRawValue(rawAnswer);
        
        if (value === undefined || value === null) return;

        // Store sync metadata
        if (typeof rawAnswer === 'object' && rawAnswer !== null && rawAnswer.answerId) {
            result.metadata[mapping.targetFieldPath] = {
                answerId: rawAnswer.answerId,
                sourceKey: mapping.sourceKey
            };
        }

        // Apply transformations
        switch (mapping.transformation) {
            case 'cast_number':
                value = (value === undefined || value === null || value === '') ? 0 : Number(value);
                break;
            case 'boolean_map':
                if (Array.isArray(value)) {
                    // Checkbox case: if any selected value exists, treat as true
                    value = value.length > 0;
                } else {
                    value = !!value && (value === 'Yes' || value === 'true' || value === true || value === 1 || value === '1');
                }
                break;
            case 'lookup':
                // For radio/select, find specific mapping
                const lookup = mapping.lookupOptions.find(opt => opt.sourceValue == value);
                if (lookup) value = lookup.targetValue;
                break;
            case 'calculation':
                const keys = mapping.sourceKeys && mapping.sourceKeys.length > 0 ? mapping.sourceKeys : [mapping.sourceKey];
                
                if (mapping.operation === 'formula' && mapping.formula) {
                    let formulaResult = mapping.formula;
                    keys.forEach(k => {
                        const v = getRawValue(sourceData[k]) || '';
                        formulaResult = formulaResult.replace(new RegExp(`{{${k}}}`, 'g'), v);
                    });
                    // Try to evaluate if it looks like a numeric formula, otherwise return as string
                    try {
                        // Simple numeric evaluation for safety, or keep as string
                        if (/^[0-9+\-*/().\s]+$/.test(formulaResult)) {
                            value = eval(formulaResult);
                        } else {
                            value = formulaResult;
                        }
                    } catch (e) {
                        value = formulaResult;
                    }
                } else if (mapping.operation === 'concat') {
                    const sep = mapping.separator || ' ';
                    value = keys.map(k => getRawValue(sourceData[k])).filter(v => v !== undefined && v !== null && v !== '').join(sep);
                } else if (mapping.operation === 'and') {
                    value = keys.every(k => {
                        const v = getRawValue(sourceData[k]);
                        return !!v && (v === 'Yes' || v === 'true' || v === true || v === 1 || v === '1');
                    });
                } else if (mapping.operation === 'or') {
                    value = keys.some(k => {
                        const v = getRawValue(sourceData[k]);
                        return !!v && (v === 'Yes' || v === 'true' || v === true || v === 1 || v === '1');
                    });
                } else if (mapping.operation === 'count') {
                    value = keys.filter(k => {
                        const v = getRawValue(sourceData[k]);
                        return v !== undefined && v !== null && v !== '';
                    }).length;
                } else {
                    // Numeric Aggregations
                    const vals = keys.map(k => {
                        const v = getRawValue(sourceData[k]);
                        if (Array.isArray(v)) return v.length; // If checkbox, use count
                        return (v === undefined || v === null || v === '') ? 0 : Number(v);
                    });
                    
                    if (mapping.operation === 'sum') {
                        value = vals.reduce((a, b) => a + b, 0);
                    } else if (mapping.operation === 'average') {
                        value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    } else if (mapping.operation === 'min') {
                        value = Math.min(...vals);
                    } else if (mapping.operation === 'max') {
                        value = Math.max(...vals);
                    }
                }
                break;
            // 'direct' case does nothing
        }

        setNestedValue(result.data, mapping.targetFieldPath, value);
    });

    return result;
};
