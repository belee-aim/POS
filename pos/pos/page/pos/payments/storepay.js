Payments.Storepay = class {
    constructor(wrapper, events, payment, storepaySettings) {
        this.wrapper = wrapper;
        this.events = events;
        this.payment = payment;
        this.storepaySettings = storepaySettings;

        this.init();
    }

    init() {
        this.wrapper.empty();
        const mode = erpnext.PointOfSale.Payment.sanitize_mode_of_payment(this.payment.mode_of_payment);

        this.wrapper.append(`
            <div class="storepay-container">
                <h4 class="payment-mode-name">Storepay</h4>
                <div class="invoice-form">
                    <div class="amount-control"></div>
                    <div class="invoice-choices">
                        <div class="phone-number-control"></div>
                    </div>
                </div>
            </div>
        `);

        this.wrapper.find(".invoice-choices")
            .css("display", "flex")
            .css("flex-direction", "row")
            .css("gap", "8px")

        this.$invoiceForm = this.wrapper.find(".invoice-form");

        const me = this;
        this.amountControl = frappe.ui.form.make_control({
            df: {
                label: "Amount",
                fieldtype: "Currency",
            },
            parent: this.wrapper.find(`.amount-control`),
            render_input: true,
        });
        this.amountControl.set_value(this.payment.amount);

        this.phoneNumberControl = frappe.ui.form.make_control({
            df: {
                label: "Phone number",
                fieldtype: "Data",
                placeholder: "Please enter phone number",
            },
            parent: this.wrapper.find(`.phone-number-control`),
            render_input: true,
        });
    }
}