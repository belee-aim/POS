ebarimt.Dialog = class {
    constructor({events}) {
        this.events = events;
        const dialog = new frappe.ui.Dialog({
            title: 'Баримт үүсгэх',
            fields: [
                {
                    label: 'Төрөл',
                    fieldname: 'type',
                    fieldtype: 'Select',
                    options: [
                        {value: 'B2C_RECEIPT', label: 'Хувь хүн'},
                        {value: 'B2B_RECEIPT', label: 'Байгууллага'},
                        {value: 'B2C_INVOICE', label: 'Хувь хүн нэхэмжлэл'},
                        {value: 'B2B_INVOICE', label: 'Байгууллага нэхэмжлэл'},
                    ],
                    default: 'B2C_RECEIPT',
                    change: () => {
                        console.log(dialog);
                        let type = dialog.get_value('type');
                        if(type.includes('B2C')) {
                            dialog.get_field('companyReg').df.hidden = 1;
                            dialog.get_field('companyName').df.hidden = 1;
                            dialog.get_primary_btn().prop('disabled', false);
                        } else {
                            dialog.set_value('companyReg', '');
                            dialog.set_value('companyName', '');

                            dialog.get_field('companyReg').df.hidden = 0;
                            dialog.get_field('companyName').df.hidden = 0;
                            dialog.get_primary_btn().prop('disabled', true);
                        }

                        dialog.refresh();
                    }
                },
                {
                    label: 'Компаний регистр',
                    fieldname: 'companyReg',
                    fieldtype: 'Data',
                    change: async () => {
                        dialog.get_field("companyName").$input.prop('readonly', true);

                        let companyReg = dialog.get_value('companyReg');
                        if(!companyReg) {
                            return
                        }

                        frappe.call({
                            method: 'pos.api.ebarimt.get_merchant_info_by_regno',
                            args: {
                                regNo: companyReg,
                            },
                            callback: ({message}) => {
                                if(message.found) {
                                    dialog.set_value('companyName', message.name);
                                    dialog.get_primary_btn().prop('disabled', false);

                                } else {
                                    dialog.set_value('companyName', 'Компани олдсонгүй');
                                    dialog.get_primary_btn().prop('disabled', true);
                                }
                                dialog.refresh();
                            },
                            error: (err) => {
                                dialog.set_value('companyName', 'Алдаа гарлаа');
                                dialog.get_primary_btn().prop('disabled', true);
                                dialog.refresh();
                            }
                        });
                    },
                    hidden: 1,
                },
                {
                    label: 'Компаний нэр',
                    fieldname: 'companyName',
                    fieldtype: 'Data',
                    hidden: 1,
                }
            ],
            primary_action_label: 'Баримт гаргах',
            primary_action: (values) => {
                const frm = events.get_frm();
                
                frappe.call({
                    method: 'pos.api.ebarimt.submit_receipt',
                    args: {
                        receiptParams: values, 
                        invoiceDoc: frm.doc,
                    },
                    callback: ({message}) => {
                        frm.set_value("custom_ebarimt_receipt", message.name);
                        frm.refresh();
                        events.onInvoiceSubmitted();
                        dialog.hide();
                    },
                    error: () => {
                        console.log('error');
                    }
                });
            },
        });

        this.dialog = dialog;
    }

    openDialog() {
        this.dialog.show();
    }
}