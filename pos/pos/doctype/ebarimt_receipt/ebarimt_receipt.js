// Copyright (c) 2025, AIM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Ebarimt Receipt", {
	refresh(frm) {
        frm.add_custom_button(__('Баримт буцаах'), function() {
            frappe.call({
                method: "pos.api.ebarimt.return_receipt",
                args: {
                    invoice_doc_name: frm.docname,
                }
            });
        }, __('Actions'));
        frm.add_custom_button(__('Баримт засварлах'), function() {
            frappe.call({
                method: "pos.api.ebarimt.update_receipt",
                args: {
                    invoice_doc_name: frm.docname,
                }
            });
        }, __('Actions'));

        const data = JSON.parse(frm.doc.data);
        if(data.type.includes("INVOICE")) {

            frm.add_custom_button(__('Нэхэмжлэл төлөх'), function() {
                frappe.call({
                    method: "pos.api.ebarimt.pay_invoice",
                    args: {
                        invoice_doc_name: frm.docname,
                    }
                });
            }, __('Actions'));
        }
	},
});