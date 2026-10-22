import Organization from '../models/Organization.js';
import Subcity from '../models/Subcity.js';
import Woreda from '../models/Woreda.js';

export const createOrganization = async (data) => {
    if (data.subcity) {
        const sub = await Subcity.findById(data.subcity);
        if (sub) {
            data.subcityName = sub.name;
        }
    }
    const organization = new Organization(data);
    const saved = await organization.save();
    return await getOrganizationById(saved._id);
};

export const getAllOrganizations = async () => {
    const orgs = await Organization.find()
        .populate('parentId', 'name type')
        .populate('subcity', 'name');

    const allWoredas = await Woreda.find().select('name subcity').lean();
    const woredasBySubcity = {};
    for (const w of allWoredas) {
        const sId = w.subcity ? w.subcity.toString() : '';
        if (!woredasBySubcity[sId]) woredasBySubcity[sId] = [];
        woredasBySubcity[sId].push(w);
    }

    return orgs.map(org => {
        const obj = org.toObject();
        const subId = obj.subcity?._id ? obj.subcity._id.toString() : (obj.subcity ? obj.subcity.toString() : '');
        const branchWoredas = subId && woredasBySubcity[subId] ? woredasBySubcity[subId] : [];
        obj.woredas = branchWoredas;
        obj.woredasCount = branchWoredas.length;
        if (obj.subcity && obj.subcity.name) {
            obj.subcityName = obj.subcity.name;
        }
        return obj;
    });
};

export const getOrganizationById = async (id) => {
    const org = await Organization.findById(id)
        .populate('parentId', 'name type')
        .populate('subcity', 'name');
    if (!org) return null;

    const obj = org.toObject();
    if (obj.subcity) {
        const subId = obj.subcity._id || obj.subcity;
        const branchWoredas = await Woreda.find({ subcity: subId }).select('name subcity').lean();
        obj.woredas = branchWoredas;
        obj.woredasCount = branchWoredas.length;
        if (obj.subcity.name) {
            obj.subcityName = obj.subcity.name;
        }
    } else {
        obj.woredas = [];
        obj.woredasCount = 0;
    }
    return obj;
};

export const updateOrganization = async (id, data) => {
    if (data.subcity) {
        const sub = await Subcity.findById(data.subcity);
        if (sub) {
            data.subcityName = sub.name;
        }
    }
    await Organization.findByIdAndUpdate(id, data, { new: true });
    return await getOrganizationById(id);
};

export const deleteOrganization = async (id) => {
    return await Organization.findByIdAndDelete(id);
};

