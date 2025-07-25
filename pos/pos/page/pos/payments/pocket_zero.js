Payments.PocketZero = class {
    constructor(wrapper, events, payment, pocketZeroSettings) {
        this.wrapper = wrapper;
        this.events = events;
        this.payment = payment;
        this.pocketZeroSettings = pocketZeroSettings;

        this.init();

        this.onlinePaymentInvoice = undefined;
    }

    init() {
        this.wrapper.empty();

        this.wrapper.append(`
            <div class="pocket-zero-container">
                <h4 class="payment-mode-name">Pocket Zero</h4>
                <div class="invoice-form">
                    <div class="amount-control"></div>
                    <div class="primary-action submit-invoice-btn">Submit Invoice</div>
                </div>
                <div class="invoice-confirmation">
                    <div id="invoice-qr"></div>
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

        this.$invoiceForm.find(".submit-invoice-btn")
            .css("background-color", "var(--blue-500)")
            .css("color", "white")

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
        this.subscribeRealtime();
    }

    addControls() {
        this.amountControl = frappe.ui.form.make_control({
            df: {
                label: "Amount",
                fieldtype: "Currency",
            },
            parent: this.wrapper.find(`.amount-control`),
            render_input: true,
        });
        this.amountControl.set_value(this.payment.amount);
    }

    addEvents() {
        this.$invoiceForm.find(".submit-invoice-btn").on("click", () => {
            if(this.amountControl.value <= 0) {
                return;
            }

            frappe.call({
                method: "pos.api.online_payment.pocket_zero.create_invoice",
                args: {
                    pocketZeroSettingsName: this.pocketZeroSettings.name,
                    amount: this.amountControl.value,
                },
                callback: ({message}) => {
                    this.show_component(this.$invoiceConfirmation, "flex");
                    this.onlinePaymentInvoice = message;

                    const data = JSON.parse(message.data);

                    new QRCode("invoice-qr", {
                        text: data.qr,
                        width: 256,
                        height: 256,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.M
                    });
                }
            });
        });

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

    subscribeRealtime() {
        frappe.realtime.on("online_payment_invoice_paid", (data) => {
            if(data.op_inv_name === this.onlinePaymentInvoice.name) {
                this.onInvoicePaid();
            }
        });
    }

    submitInvoice(amount) {
        if(typeof(amount) !== 'number' || amount <= 0) {
            return;
        }
        
        frappe.call({
            method: "pos.api.online_payment.pocket_zero.create_invoice",
            args: {
                pocketZeroSettingsName: thispocketZeroSettings.name,
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