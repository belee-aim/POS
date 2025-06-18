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
                    options: ['Хувь хүн', 'Байгууллага'],
                    change: () => {
                        console.log(dialog);
                        let type = dialog.get_value('type');
                        if(type === 'Хувь хүн') {
                            dialog.get_field('companyReg').df.hidden = 1;
                            dialog.get_field('companyName').df.hidden = 1;
                        } else {
                            dialog.get_field('companyReg').df.hidden = 0;
                            dialog.get_field('companyName').df.hidden = 0;
                        }

                        dialog.refresh();
                    }
                },
                {
                    label: 'Компаний регистр',
                    fieldname: 'companyReg',
                    fieldtype: 'Data',
                    change: async () => {
                        let companyReg = dialog.get_value('companyReg');

                        frappe.call({
                            method: 'pos.api.ebarimt.ebarimt_get_merchant_info',
                            args: {
                                regNo: companyReg,
                            },
                            callback: ({message}) => {
                                console.log(message);
                                if(message.found) {
                                    dialog.set_value('companyName', message.name);
                                } else {
                                    dialog.set_value('companyName', 'Компани олдсонгүй');
                                }
                                dialog.refresh();
                            },
                            error: (err) => {
                                dialog.set_value('companyName', 'Алдаа гарлаа');
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
                    change: () => {
                        console.log(dialog.values);
                    },
                    hidden: 1,
                    disabled: 1,
                }
            ]
        });
        this.dialog = dialog;
    }

    openDialog() {
        this.dialog.show();
    }
}