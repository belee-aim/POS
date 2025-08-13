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
        });
        frm.add_custom_button(__('Баримт засварлах'), function() {
            frappe.call({
                method: "pos.api.ebarimt.update_receipt",
                args: {
                    invoice_doc_name: frm.docname,
                }
            });
        });

        const pay_invoice_dialog = new frappe.ui.Dialog({
			title: __("Нэхэмжлэл төлөх"),
            size: "large",
			fields: [
				{
					fieldname: "payments",
					fieldtype: "Table",
					label: __("Төлөлтийн хэлбэрүүд"),
					cannot_add_rows: false,
					in_place_edit: true,
					reqd: 1,
					data: [],
					fields: [
                        {
                            fieldname: "code",
                            fieldtype: "Select",
                            in_list_view: 1,
                            label: __("Төлбөрийн хэлбэрийн код"),
                            options: ["CASH: Бэлнээр", "PAYMENT_CARD: Төлбөрийн карт"],
                            reqd: 1,
                        },
                        {
                            fieldname: "status",
                            fieldtype: "Select",
                            in_list_view: 1,
                            label: __("Төлбөрийн хэлбэрийн төлөв"),
                            options: [
                                "PAID: Төлбөр амжилттай хийгдсэнийг тодорхойлоно",
                                "PAY: Төлбөрийн мэдээллийг “Баримтын мэдээлэл солилцох сервис”-г ашиглан гүйцэтгэнэ./ Баримтын мэдээлэл солилцох сервис хэсэгийг харан уу./",
                                "REVERSED: Төлбөр буцаагдсан /Баримтын мэдээлэл солилцох сервис хэсэгийг харан уу. /",
                                "ERROR: Төлөлт амжилтгүй болсон /Баримтын мэдээлэл солилцох сервис хэсэгийг харан уу. /",
                            ],
                            reqd: 1,
                        },
                        {
                            fieldname: "paidAmount",
                            fieldtype: "Float",
                            in_list_view: 1,
                            label: __("Төлсөн дүн"),
                            reqd: 1,
                        },
                    ],
				},
			],
			primary_action: async function (values) {
                const {message} = await frappe.call({
                    "method": "pos.api.ebarimt.pay_invoice",
                    args:{
                        invoice_doc_name: frm.docname,
                        payments: values.payments,
                    }
                })
				pay_invoice_dialog.hide();
                frappe.set_route("Form", "Ebarimt Receipt", message.name);
			},
			primary_action_label: __("Илгээх"),
        })

        const data = JSON.parse(frm.doc.data);
        if(data.type.includes("INVOICE")) {
            frm.add_custom_button(__('Нэхэмжлэл төлөх'), function() {
                pay_invoice_dialog.show();
            });
        }
	},
});