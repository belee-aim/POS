Payments.Storepay = class {
    constructor(wrapper, events, payment, storepaySettingsName) {
        this.wrapper = wrapper;
        this.events = events;
        this.payment = payment;
        this.storepaySettingsName = storepaySettingsName;

        this.init();

        this.onlinePaymentInvoice = undefined;
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
                <div class="invoice-confirmation">
                    <span class="loader"></span>
                    <div>
                        <p>Invoice has been sent, waiting for confirmation</p>
                    </div>
                    <div class="check-confirmation-btn primary-action">Check confirmation</div>
                </div>
                <div class="invoice-after-confirmation">
                    <p>Invoice succesfully confirmed</p>
                </div>
            </div>
        `);

        this.$invoiceForm = this.wrapper.find(".invoice-form");
        this.$invoiceConfirmation = this.wrapper.find(".invoice-confirmation");
        this.$afterInvoiceConfirmation = this.wrapper.find(".invoice-after-confirmation");

        this.wrapper.find(".invoice-choices")
            .css("display", "flex")
            .css("flex-direction", "row")
            .css("gap", "8px")

        this.$invoiceConfirmation
            .css("display", "flex")
            .css("flex-direction", "column")
            .css("justify-content", "center")
            .css("align-items", "center")
            .css("gap", "8px")

        this.$invoiceConfirmation.find(".check-confirmation-btn")
            .css("background-color", "var(--blue-500)")
            .css("color", "white")

        this.$afterInvoiceConfirmation
            .css("display", "block")

        this.show_component(this.$invoiceForm);
        
        this.addControls();
        this.addEvents();
    }

    addControls() {
        this.amountControl = frappe.ui.form.make_control({
            df: {
                label: "Amount",
                fieldtype: "Currency",
                onchange: (event) => {
                    if(event.type !== 'change') {
                        return;
                    }
                    this.submitInvoice(this.amountControl.value, this.phoneNumberControl.value);
                }
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
                onchange: (event) => {
                    if(event.type !== 'change') {
                        return;
                    }
                    this.submitInvoice(this.amountControl.value, this.phoneNumberControl.value);
                }
            },
            parent: this.wrapper.find(`.phone-number-control`),
            render_input: true,
        });
    }

    addEvents() {
        this.$invoiceConfirmation.find(".check-confirmation-btn").on("click", () => {
            if(!this.onlinePaymentInvoice) {
                return;
            }

            frappe.call({
                method: "pos.api.online_payment.invoice.check_invoice",
                args: {
                    op_inv_name: this.onlinePaymentInvoice.name
                },
                callback: ({message}) => {
                    const isPaid = message;

                    if(isPaid) {
                        this.onInvoicePaid();
                    }
                }
            })
        });
    }

    submitInvoice(amount, phone_number) {
        if(typeof(amount) !== 'number' || amount <= 0) {
            return;
        }
        if(typeof(phone_number) !== 'string' || phone_number.length !== 8) {
            return;
        }
        
        frappe.call({
            method: "pos.api.online_payment.storepay.create_invoice_by_phone_number",
            args: {
                storepaySettingsName: this.storepaySettingsName,
                phone_number,
                amount,
            },
            callback: ({message}) => {
                this.show_component(this.$invoiceConfirmation, "flex");
                this.onlinePaymentInvoice = message;
            }
        })
    }

    async onInvoicePaid() {
        const {message} = await frappe.db.get_value(this.onlinePaymentInvoice.doctype, this.onlinePaymentInvoice.name, "amount");
        const invoiceAmount = message.amount;
        frappe.model.set_value(this.payment.doctype, this.payment.name, "amount", invoiceAmount);

        this.show_component(this.$afterInvoiceConfirmation, "block");
    }

    show_component(component, display) {
        const components = [
            this.$invoiceForm,
            this.$invoiceConfirmation,
            this.$afterInvoiceConfirmation,
        ]

        components.forEach(c => c.css("display", "none"));
        component.css("display", display ?? "block");
    }
}