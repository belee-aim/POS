// Copyright (c) 2025, AIM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ebarimt Merchant Info", {
	refresh(frm) {
        frm.set_df_property('merchant_name', 'disabled', true);
        fetch_district_codes(frm);
	},

    merchant_register(frm) {
        fetch_merchant_info(frm);
    },

    validate(frm) {
        const merchant_name = frm.get_field('merchant_name').value;

        if(merchant_name === 'уншиж байна...' || merchant_name === 'Компани олдсонгүй') {
            frappe.validated = false;
            frappe.throw("Компаний регистрийг зөв оруулна уу.")
        }
        frappe.validated = true;
    }
});

const fetch_merchant_info = async (frm) => {
    const update_merchant_name_df = (value) => {
        frm.set_value('merchant_name', value);
        frm.set_df_property('merchant_name', 'disabled', true);
        frm.refresh_field('merchant_name');
    }

    update_merchant_name_df('уншиж байна...');

    const merchant_register = frm.get_field('merchant_register').value;
    if(!merchant_register) {
        return;
    }

    frappe.call({
        method: "pos.api.ebarimt.get_merchant_info_by_regno",
        args: {
            regNo: merchant_register
        },
        callback: (resp) => {
            if(!resp.message) {
                update_merchant_name_df('Компани олдсонгүй');
                return;
            }

            const {message} = resp;
            update_merchant_name_df(message.name);
        },
        error: () => {
            update_merchant_name_df('Алдаа гарлаа');
        }
    })
}

const fetch_district_codes = async (frm) => {
    frm.set_df_property('district_code', 'options', ['уншиж байна...']);
    
    frappe.call({
        method: "pos.api.ebarimt.get_branch_codes",
        callback: ({message})=> {
            frm.set_df_property('district_code', 'options', message.data.map(branchInfo => {
                const {branchCode, branchName, subBranchCode, subBranchName} = branchInfo;
                return `${branchName}, ${subBranchName}: ${branchCode}${subBranchCode}`;
            }).sort().join("\n"));
            frm.refresh_field('district_code');
        }
    })
}