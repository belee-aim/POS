// Copyright (c) 2025, AIM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ebarimt Merchant Info", {
	refresh(frm) {
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
	},
});