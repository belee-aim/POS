Payments.DefaultPayment = class {
    constructor(wrapper, events, payment) {
        this.wrapper = wrapper;
        this.events = events;
        this.payment = payment;

        this.init();
    }

    init() {
        this.wrapper.empty();
        const mode = erpnext.PointOfSale.Payment.sanitize_mode_of_payment(this.payment.mode_of_payment);

        this.wrapper.append(`
            <h4 class="payment-mode-name">${this.payment.mode_of_payment}</h4>
            <div class="${mode} mode-of-payment-control"></div>
        `);

        const me = this;
        this.amountControl = frappe.ui.form.make_control({
            df: {
                label: me.payment.mode_of_payment,
                fieldtype: "Currency",
                placeholder: __("Enter {0} amount.", [me.payment.mode_of_payment]),
                onchange: function () {
                    const current_value = frappe.model.get_value(me.payment.doctype, me.payment.name, "amount");
                    if (current_value != this.value) {
                        frappe.model
                            .set_value(me.payment.doctype, me.payment.name, "amount", flt(this.value))
                    }
                },
            },
            parent: this.wrapper.find(`.${mode}.mode-of-payment-control`),
            render_input: true,
        });
        this.amountControl.toggle_label(false);
        this.amountControl.set_value(this.payment.amount);
    }

    set_remaining_amount(remaining_amount) {
        const current_value = frappe.model.get_value(this.payment.doctype, this.payment.name, "amount");
        
        if(current_value === 0) {
            this.amountControl.set_value(remaining_amount);
        }
    }
}