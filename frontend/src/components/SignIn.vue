<template>
  <div class="auth-page" :class="{ 'auth-page--modal': isModal }">
    <div v-if="!isModal" class="auth-header-left">
      <BaseButton variant="ghost" size="sm" @click="goToMarketplace" class="back-button">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </BaseButton>
    </div>
    <div v-if="!isModal" class="auth-header-controls">
      <ThemeToggle />
    </div>
    <BaseCard v-if="!isModal" class="auth-card" padding="lg">
      <template #header>
        <div v-if="!isSignUp && resetStep === 'none'" class="auth-header">
          <img
            src="/direct-market.svg"
            width="64"
            height="64"
            alt="Direct Market Logo"
            class="auth-logo"
          />
        </div>
      </template>

      <form @submit.prevent="handleSubmit" class="auth-form" novalidate>
        <template v-if="resetStep === 'none' && (!isSignUp || signupStep === 'form')">
          <BaseInput
            v-model="formData.email"
            type="email"
            label="Email Address"
            placeholder="Enter your email"
            required
            autocomplete="email"
            :error="getFieldError('email') || undefined"
            @blur="validateFieldByName('email')"
          />

          <BaseInput
            v-model="formData.password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            required
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            :error="getFieldError('password') || undefined"
            @blur="validateFieldByName('password')"
          />

          <div v-if="!isSignUp && app.error" class="forgot-row">
            <BaseButton variant="ghost" size="xs" type="button" @click="startReset">
              Forgot your password?
            </BaseButton>
          </div>

          <template v-if="isSignUp">
            <BaseInput
              v-model="formData.given_name"
              type="text"
              label="First Name"
              placeholder="Enter your first name"
              required
              autocomplete="given-name"
              :error="getFieldError('given_name') || undefined"
              @blur="validateFieldByName('given_name')"
            />

            <BaseInput
              v-model="formData.family_name"
              type="text"
              label="Last Name"
              placeholder="Enter your last name"
              required
              autocomplete="family-name"
              :error="getFieldError('family_name') || undefined"
              @blur="validateFieldByName('family_name')"
            />
          </template>
        </template>

        <template v-else-if="isSignUp && signupStep === 'otp'">
          <div>
            <label class="otp-label">Enter 6-digit code</label>
            <div class="otp-inputs" role="group" aria-label="One time code">
              <input
                v-for="(_, i) in 6"
                :key="i"
                class="otp-input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="1"
                :aria-label="`Digit ${i + 1}`"
                :value="signupOtpDigits[i]"
                :ref="(el) => setSignupOtpRef(el, i)"
                @input="onSignupOtpInput(i, $event as InputEvent)"
                @keydown="onSignupOtpKeydown(i, $event as KeyboardEvent)"
                @paste="onSignupOtpPaste($event as ClipboardEvent)"
              />
            </div>
            <p v-if="getFieldError('signup_otp')" class="otp-error">
              {{ getFieldError('signup_otp') }}
            </p>
          </div>
          <div class="forgot-row">
            <BaseButton variant="ghost" size="xs" type="button" @click="backToSignupForm">
              Didn't get a code? Go back
            </BaseButton>
          </div>
        </template>

        <template v-else-if="resetStep === 'request'">
          <BaseInput
            v-model="formData.email"
            type="email"
            label="Email Address"
            placeholder="Enter your email"
            required
            autocomplete="email"
            :error="getFieldError('email') || undefined"
            @blur="validateFieldByName('email')"
          />
          <div class="forgot-row">
            <BaseButton variant="ghost" size="xs" type="button" @click="cancelReset">
              Back to Sign In
            </BaseButton>
          </div>
        </template>

        <template v-else-if="resetStep === 'confirm'">
          <BaseInput
            v-model="formData.email"
            type="email"
            label="Email Address"
            placeholder="Enter your email"
            required
            autocomplete="email"
            :error="getFieldError('email') || undefined"
            @blur="validateFieldByName('email')"
          />
          <div>
            <label class="otp-label">Enter 6-digit code</label>
            <div class="otp-inputs" role="group" aria-label="One time code">
              <input
                v-for="(_, i) in 6"
                :key="i"
                class="otp-input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="1"
                :aria-label="`Digit ${i + 1}`"
                :value="otpDigits[i]"
                :ref="(el) => setOtpRef(el, i)"
                @input="onOtpInput(i, $event as InputEvent)"
                @keydown="onOtpKeydown(i, $event as KeyboardEvent)"
                @paste="onOtpPaste($event as ClipboardEvent)"
              />
            </div>
            <p v-if="getFieldError('otp')" class="otp-error">{{ getFieldError('otp') }}</p>
          </div>

          <Transition name="fade-slide">
            <div v-if="otpComplete" class="new-password-fields">
              <BaseInput
                v-model="formData.new_password"
                type="password"
                label="New Password"
                placeholder="Enter your new password"
                required
                autocomplete="new-password"
                class="pb-md"
                :error="getFieldError('new_password') || undefined"
                @blur="validateFieldByName('new_password')"
              />
              <BaseInput
                v-model="formData.confirm_password"
                type="password"
                label="Confirm New Password"
                placeholder="Re-enter your new password"
                required
                autocomplete="new-password"
                :error="getFieldError('confirm_password') || undefined"
                @blur="validateFieldByName('confirm_password')"
              />
            </div>
          </Transition>
          <div class="forgot-row">
            <BaseButton variant="ghost" size="xs" type="button" @click="backToRequest">
              Didn't get a code? Resend
            </BaseButton>
          </div>
        </template>

        <div class="form-actions">
          <template v-if="resetStep === 'request'">
            <BaseButton
              type="submit"
              :loading="app.isLoading"
              :disabled="
                hasErrors && Object.keys(validation).some((key) => validation[key].touched)
              "
              full-width
              size="lg"
            >
              Send Reset Code
            </BaseButton>
          </template>
          <template v-else-if="resetStep === 'confirm'">
            <BaseButton
              v-if="otpComplete"
              type="submit"
              :loading="app.isLoading"
              :disabled="
                hasErrors && Object.keys(validation).some((key) => validation[key].touched)
              "
              full-width
              size="lg"
            >
              Reset Password
            </BaseButton>
          </template>
          <template v-else-if="isSignUp && signupStep === 'otp'">
            <BaseButton
              type="submit"
              :loading="app.isLoading"
              :disabled="
                !signupOtpComplete ||
                (hasErrors && Object.keys(validation).some((key) => validation[key].touched))
              "
              full-width
              size="lg"
            >
              Complete Registration
            </BaseButton>
          </template>
          <template v-else>
            <BaseButton
              type="submit"
              :loading="app.isLoading"
              :disabled="
                hasErrors && Object.keys(validation).some((key) => validation[key].touched)
              "
              full-width
              size="lg"
            >
              {{ isSignUp ? 'Continue' : 'Sign In' }}
            </BaseButton>

            <div class="button-row">
              <BaseButton
                v-if="!isSignUp"
                type="button"
                variant="outline"
                full-width
                size="lg"
                @click="handleGoogleSignIn"
                :disabled="app.isLoading"
              >
                <svg
                  viewBox="-0.5 0 48 48"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  fill="#000000"
                  width="18"
                  height="18"
                >
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <title>Google-color</title>
                    <desc>Created with Sketch.</desc>
                    <defs></defs>
                    <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                      <g id="Color-" transform="translate(-401.000000, -860.000000)">
                        <g id="Google" transform="translate(401.000000, 860.000000)">
                          <path
                            d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24"
                            id="Fill-1"
                            fill="#FBBC05"
                          ></path>
                          <path
                            d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333"
                            id="Fill-2"
                            fill="#EB4335"
                          ></path>
                          <path
                            d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667"
                            id="Fill-3"
                            fill="#34A853"
                          ></path>
                          <path
                            d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24"
                            id="Fill-4"
                            fill="#4285F4"
                          ></path>
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
              </BaseButton>

              <BaseButton
                v-if="!isSignUp"
                type="button"
                variant="outline"
                full-width
                size="lg"
                @click="handleAppleSignIn"
                :disabled="app.isLoading"
              >
                <svg
                  viewBox="-3.5 0 48 48"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  width="18"
                  height="18"
                  class="apple-logo"
                >
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <title>Apple-color</title>
                    <desc>Created with Sketch.</desc>
                    <defs></defs>
                    <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                      <g id="Color-" transform="translate(-204.000000, -560.000000)">
                        <path
                          d="M231.174735,567.792499 C232.740177,565.771699 233.926883,562.915484 233.497649,560 C230.939077,560.177808 227.948466,561.814769 226.203475,563.948463 C224.612784,565.88177 223.305444,568.757742 223.816036,571.549042 C226.613071,571.636535 229.499881,569.960061 231.174735,567.792499 L231.174735,567.792499 Z M245,595.217241 C243.880625,597.712195 243.341978,598.827022 241.899976,601.03692 C239.888467,604.121745 237.052156,607.962958 233.53412,607.991182 C230.411652,608.02505 229.606488,605.94498 225.367451,605.970382 C221.128414,605.99296 220.244696,608.030695 217.116618,607.999649 C213.601387,607.968603 210.913765,604.502761 208.902256,601.417937 C203.27452,592.79849 202.68257,582.680377 206.152914,577.298162 C208.621711,573.476705 212.515678,571.241407 216.173986,571.241407 C219.89682,571.241407 222.239372,573.296075 225.322563,573.296075 C228.313175,573.296075 230.133913,571.235762 234.440281,571.235762 C237.700215,571.235762 241.153726,573.022307 243.611302,576.10431 C235.554045,580.546683 236.85858,592.121127 245,595.217241 L245,595.217241 Z"
                          id="Apple"
                        ></path>
                      </g>
                    </g>
                  </g>
                </svg>
              </BaseButton>
            </div>
          </template>
        </div>
        <BaseAlert
          v-if="notice"
          variant="success"
          :message="notice"
          :show="!!notice"
          dismissible
          @dismiss="notice = ''"
        />
        <BaseAlert
          v-if="app.error"
          variant="error"
          :message="app.error"
          :show="!!app.error"
          dismissible
          @dismiss="app.error = null"
        />
      </form>

      <template #footer>
        <div
          v-if="resetStep === 'none' && (!isSignUp || signupStep === 'form')"
          class="auth-footer"
        >
          <p class="toggle-text">
            {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          </p>
          <BaseButton variant="ghost" @click="toggleMode" size="sm">
            {{ isSignUp ? 'Sign In' : 'Sign Up' }}
          </BaseButton>
        </div>
        <div v-else class="auth-footer">
          <p class="toggle-text">
            Having trouble? Let me know what's going on at
            <a href="mailto:cal.macconnachie@gmail.com">cal.macconnachie@gmail.com</a>
          </p>
        </div>
      </template>
    </BaseCard>

    <!-- Modal Version (no card wrapper) -->
    <form v-else @submit.prevent="handleSubmit" class="auth-form auth-form--modal" novalidate>
      <div v-if="!isSignUp && resetStep === 'none'" class="auth-header auth-header--modal">
        <img
          src="/direct-market.svg"
          width="48"
          height="48"
          alt="Direct Market Logo"
          class="auth-logo"
        />
      </div>

      <template v-if="resetStep === 'none' && (!isSignUp || signupStep === 'form')">
        <BaseInput
          v-model="formData.email"
          type="email"
          label="Email Address"
          placeholder="Enter your email"
          required
          autocomplete="email"
          :error="getFieldError('email') || undefined"
          @blur="validateFieldByName('email')"
        />

        <BaseInput
          v-model="formData.password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          required
          :autocomplete="isSignUp ? 'new-password' : 'current-password'"
          :error="getFieldError('password') || undefined"
          @blur="validateFieldByName('password')"
        />

        <div v-if="!isSignUp && app.error" class="forgot-row">
          <BaseButton variant="ghost" size="xs" type="button" @click="startReset">
            Forgot your password?
          </BaseButton>
        </div>

        <template v-if="isSignUp">
          <BaseInput
            v-model="formData.given_name"
            type="text"
            label="First Name"
            placeholder="Enter your first name"
            required
            autocomplete="given-name"
            :error="getFieldError('given_name') || undefined"
            @blur="validateFieldByName('given_name')"
          />

          <BaseInput
            v-model="formData.family_name"
            type="text"
            label="Last Name"
            placeholder="Enter your last name"
            required
            autocomplete="family-name"
            :error="getFieldError('family_name') || undefined"
            @blur="validateFieldByName('family_name')"
          />
        </template>
      </template>

      <template v-else-if="isSignUp && signupStep === 'otp'">
        <div>
          <label class="otp-label">Enter 6-digit code</label>
          <div class="otp-inputs" role="group" aria-label="One time code">
            <input
              v-for="(_, i) in 6"
              :key="i"
              class="otp-input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              :aria-label="`Digit ${i + 1}`"
              :value="signupOtpDigits[i]"
              :ref="(el) => setSignupOtpRef(el, i)"
              @input="onSignupOtpInput(i, $event as InputEvent)"
              @keydown="onSignupOtpKeydown(i, $event as KeyboardEvent)"
              @paste="onSignupOtpPaste($event as ClipboardEvent)"
            />
          </div>
          <p v-if="getFieldError('signup_otp')" class="otp-error">
            {{ getFieldError('signup_otp') }}
          </p>
        </div>
        <div class="forgot-row">
          <BaseButton variant="ghost" size="xs" type="button" @click="backToSignupForm">
            Didn't get a code? Go back
          </BaseButton>
        </div>
      </template>

      <template v-else-if="resetStep === 'request'">
        <BaseInput
          v-model="formData.email"
          type="email"
          label="Email Address"
          placeholder="Enter your email"
          required
          autocomplete="email"
          :error="getFieldError('email') || undefined"
          @blur="validateFieldByName('email')"
        />
        <div class="forgot-row">
          <BaseButton variant="ghost" size="xs" type="button" @click="cancelReset">
            Back to Sign In
          </BaseButton>
        </div>
      </template>

      <template v-else-if="resetStep === 'confirm'">
        <BaseInput
          v-model="formData.email"
          type="email"
          label="Email Address"
          placeholder="Enter your email"
          required
          autocomplete="email"
          :error="getFieldError('email') || undefined"
          @blur="validateFieldByName('email')"
        />
        <div>
          <label class="otp-label">Enter 6-digit code</label>
          <div class="otp-inputs" role="group" aria-label="One time code">
            <input
              v-for="(_, i) in 6"
              :key="i"
              class="otp-input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              :aria-label="`Digit ${i + 1}`"
              :value="otpDigits[i]"
              :ref="(el) => setOtpRef(el, i)"
              @input="onOtpInput(i, $event as InputEvent)"
              @keydown="onOtpKeydown(i, $event as KeyboardEvent)"
              @paste="onOtpPaste($event as ClipboardEvent)"
            />
          </div>
          <p v-if="getFieldError('otp')" class="otp-error">{{ getFieldError('otp') }}</p>
        </div>

        <Transition name="fade-slide">
          <div v-if="otpComplete" class="new-password-fields">
            <BaseInput
              v-model="formData.new_password"
              type="password"
              label="New Password"
              placeholder="Enter your new password"
              required
              autocomplete="new-password"
              class="pb-md"
              :error="getFieldError('new_password') || undefined"
              @blur="validateFieldByName('new_password')"
            />
            <BaseInput
              v-model="formData.confirm_password"
              type="password"
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              required
              autocomplete="new-password"
              :error="getFieldError('confirm_password') || undefined"
              @blur="validateFieldByName('confirm_password')"
            />
          </div>
        </Transition>
        <div class="forgot-row">
          <BaseButton variant="ghost" size="xs" type="button" @click="backToRequest">
            Didn't get a code? Resend
          </BaseButton>
        </div>
      </template>

      <div class="form-actions">
        <template v-if="resetStep === 'request'">
          <BaseButton
            type="submit"
            :loading="app.isLoading"
            :disabled="hasErrors && Object.keys(validation).some((key) => validation[key].touched)"
            full-width
            size="lg"
          >
            Send Reset Code
          </BaseButton>
        </template>
        <template v-else-if="resetStep === 'confirm'">
          <BaseButton
            v-if="otpComplete"
            type="submit"
            :loading="app.isLoading"
            :disabled="hasErrors && Object.keys(validation).some((key) => validation[key].touched)"
            full-width
            size="lg"
          >
            Reset Password
          </BaseButton>
        </template>
        <template v-else-if="isSignUp && signupStep === 'otp'">
          <BaseButton
            type="submit"
            :loading="app.isLoading"
            :disabled="
              !signupOtpComplete ||
              (hasErrors && Object.keys(validation).some((key) => validation[key].touched))
            "
            full-width
            size="lg"
          >
            Complete Registration
          </BaseButton>
        </template>
        <template v-else>
          <BaseButton
            type="submit"
            :loading="app.isLoading"
            :disabled="hasErrors && Object.keys(validation).some((key) => validation[key].touched)"
            full-width
            size="lg"
          >
            {{ isSignUp ? 'Continue' : 'Sign In' }}
          </BaseButton>

          <div class="button-row">
            <BaseButton
              v-if="!isSignUp"
              type="button"
              variant="outline"
              full-width
              size="lg"
              @click="handleGoogleSignIn"
              :disabled="app.isLoading"
            >
              <svg
                viewBox="-0.5 0 48 48"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                fill="#000000"
                width="18"
                height="18"
              >
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <title>Google-color</title>
                  <desc>Created with Sketch.</desc>
                  <defs></defs>
                  <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g id="Color-" transform="translate(-401.000000, -860.000000)">
                      <g id="Google" transform="translate(401.000000, 860.000000)">
                        <path
                          d="M9.82727273,24 C9.82727273,22.4757333 10.0804318,21.0144 10.5322727,19.6437333 L2.62345455,13.6042667 C1.08206818,16.7338667 0.213636364,20.2602667 0.213636364,24 C0.213636364,27.7365333 1.081,31.2608 2.62025,34.3882667 L10.5247955,28.3370667 C10.0772273,26.9728 9.82727273,25.5168 9.82727273,24"
                          id="Fill-1"
                          fill="#FBBC05"
                        ></path>
                        <path
                          d="M23.7136364,10.1333333 C27.025,10.1333333 30.0159091,11.3066667 32.3659091,13.2266667 L39.2022727,6.4 C35.0363636,2.77333333 29.6954545,0.533333333 23.7136364,0.533333333 C14.4268636,0.533333333 6.44540909,5.84426667 2.62345455,13.6042667 L10.5322727,19.6437333 C12.3545909,14.112 17.5491591,10.1333333 23.7136364,10.1333333"
                          id="Fill-2"
                          fill="#EB4335"
                        ></path>
                        <path
                          d="M23.7136364,37.8666667 C17.5491591,37.8666667 12.3545909,33.888 10.5322727,28.3562667 L2.62345455,34.3946667 C6.44540909,42.1557333 14.4268636,47.4666667 23.7136364,47.4666667 C29.4455,47.4666667 34.9177955,45.4314667 39.0249545,41.6181333 L31.5177727,35.8144 C29.3995682,37.1488 26.7323182,37.8666667 23.7136364,37.8666667"
                          id="Fill-3"
                          fill="#34A853"
                        ></path>
                        <path
                          d="M46.1454545,24 C46.1454545,22.6133333 45.9318182,21.12 45.6113636,19.7333333 L23.7136364,19.7333333 L23.7136364,28.8 L36.3181818,28.8 C35.6879545,31.8912 33.9724545,34.2677333 31.5177727,35.8144 L39.0249545,41.6181333 C43.3393409,37.6138667 46.1454545,31.6490667 46.1454545,24"
                          id="Fill-4"
                          fill="#4285F4"
                        ></path>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
            </BaseButton>

            <BaseButton
              v-if="!isSignUp"
              type="button"
              variant="outline"
              full-width
              size="lg"
              @click="handleAppleSignIn"
              :disabled="app.isLoading"
            >
              <svg
                viewBox="-3.5 0 48 48"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                width="18"
                height="18"
                class="apple-logo"
              >
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                  <title>Apple-color</title>
                  <desc>Created with Sketch.</desc>
                  <defs></defs>
                  <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g id="Color-" transform="translate(-204.000000, -560.000000)">
                      <path
                        d="M231.174735,567.792499 C232.740177,565.771699 233.926883,562.915484 233.497649,560 C230.939077,560.177808 227.948466,561.814769 226.203475,563.948463 C224.612784,565.88177 223.305444,568.757742 223.816036,571.549042 C226.613071,571.636535 229.499881,569.960061 231.174735,567.792499 L231.174735,567.792499 Z M245,595.217241 C243.880625,597.712195 243.341978,598.827022 241.899976,601.03692 C239.888467,604.121745 237.052156,607.962958 233.53412,607.991182 C230.411652,608.02505 229.606488,605.94498 225.367451,605.970382 C221.128414,605.99296 220.244696,608.030695 217.116618,607.999649 C213.601387,607.968603 210.913765,604.502761 208.902256,601.417937 C203.27452,592.79849 202.68257,582.680377 206.152914,577.298162 C208.621711,573.476705 212.515678,571.241407 216.173986,571.241407 C219.89682,571.241407 222.239372,573.296075 225.322563,573.296075 C228.313175,573.296075 230.133913,571.235762 234.440281,571.235762 C237.700215,571.235762 241.153726,573.022307 243.611302,576.10431 C235.554045,580.546683 236.85858,592.121127 245,595.217241 L245,595.217241 Z"
                        id="Apple"
                      ></path>
                    </g>
                  </g>
                </g>
              </svg>
            </BaseButton>
          </div>
        </template>
      </div>

      <BaseAlert
        v-if="notice"
        variant="success"
        :message="notice"
        :show="!!notice"
        dismissible
        @dismiss="notice = ''"
      />
      <BaseAlert
        v-if="app.error"
        variant="error"
        :message="app.error"
        :show="!!app.error"
        dismissible
        @dismiss="app.error = null"
      />

      <div v-if="resetStep === 'none' && (!isSignUp || signupStep === 'form')" class="auth-footer">
        <p class="toggle-text">
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
        </p>
        <BaseButton variant="ghost" @click="toggleMode" size="sm">
          {{ isSignUp ? 'Sign In' : 'Sign Up' }}
        </BaseButton>
      </div>
      <div v-else class="auth-footer">
        <p class="toggle-text">
          Having trouble? Let me know what's going on at
          <a href="mailto:cal.macconnachie@gmail.com">cal.macconnachie@gmail.com</a>
        </p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { authAPI } from '@/services/api'
import { useAppStore } from '@/stores/app'
import { redirectToAppleAuth, redirectToGoogleAuth } from '@/utils/oauth'
import { useFormValidation, validationRules } from '@/utils/validation'
import { computed, nextTick, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  initialMode?: 'signin' | 'signup'
  isModal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: 'signin',
  isModal: false,
})

const emit = defineEmits<{
  authSuccess: []
}>()

const app = useAppStore()
const router = useRouter()
const route = useRoute()
const isSignUp = ref(props.initialMode === 'signup')
const resetStep = ref<'none' | 'request' | 'confirm'>('none')
const signupStep = ref<'form' | 'otp'>('form')
const notice = ref('')

const {
  formData,
  validation,
  hasErrors,
  setFieldValidation,
  removeFieldValidation,
  validateFieldByName,
  validateAllFields,
  clearValidation,
  getFieldError,
} = useFormValidation({
  email: '',
  password: '',
  given_name: '',
  family_name: '',
  // reset flow fields
  otp: '',
  new_password: '',
  confirm_password: '',
  // signup flow fields
  signup_otp: '',
})

// OTP digit management for password reset
const otpDigits = ref<string[]>(['', '', '', '', '', ''])
const otpRefs = Array.from({ length: 6 }, () => ref<HTMLInputElement | null>(null))
const setOtpRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  otpRefs[index].value = (el as HTMLInputElement) || null
}
const otpComplete = computed(() => otpDigits.value.every((d) => /^\d$/.test(d)))

// OTP digit management for signup
const signupOtpDigits = ref<string[]>(['', '', '', '', '', ''])
const signupOtpRefs = Array.from({ length: 6 }, () => ref<HTMLInputElement | null>(null))
const setSignupOtpRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  signupOtpRefs[index].value = (el as HTMLInputElement) || null
}
const signupOtpComplete = computed(() => signupOtpDigits.value.every((d) => /^\d$/.test(d)))

watch(
  otpDigits,
  () => {
    formData.otp = otpDigits.value.join('')
    // If OTP becomes complete, ensure validations for password fields are active
    if (resetStep.value === 'confirm' && otpComplete.value) {
      setFieldValidation('new_password', [
        validationRules.required('New password is required'),
        validationRules.strongPassword(),
      ])
      setFieldValidation('confirm_password', [
        validationRules.confirmPassword(formData.new_password, 'Passwords must match'),
      ])
    }
  },
  { deep: true },
)

watch(
  signupOtpDigits,
  () => {
    formData.signup_otp = signupOtpDigits.value.join('')
  },
  { deep: true },
)

const setupValidation = () => {
  setFieldValidation('email', [
    validationRules.required('Email is required'),
    validationRules.email(),
  ])

  if (resetStep.value === 'request') {
    setFieldValidation('password', [])
    setFieldValidation('given_name', [])
    setFieldValidation('family_name', [])
    setFieldValidation('otp', [])
    setFieldValidation('new_password', [])
    setFieldValidation('confirm_password', [])
    setFieldValidation('signup_otp', [])
  } else if (resetStep.value === 'confirm') {
    setFieldValidation('password', [])
    setFieldValidation('given_name', [])
    setFieldValidation('family_name', [])
    setFieldValidation('signup_otp', [])
    setFieldValidation('email', [
      validationRules.required('Email is required'),
      validationRules.email(),
    ])
    setFieldValidation('otp', [
      validationRules.required('Code is required'),
      validationRules.pattern(/^\d{6}$/, 'Enter the 6-digit code'),
    ])
    // Delay password field validations until OTP is complete
    if (otpComplete.value) {
      setFieldValidation('new_password', [
        validationRules.required('New password is required'),
        validationRules.strongPassword(),
      ])
      setFieldValidation('confirm_password', [
        validationRules.confirmPassword(formData.new_password, 'Passwords must match'),
      ])
    } else {
      setFieldValidation('new_password', [])
      setFieldValidation('confirm_password', [])
    }
  } else if (isSignUp.value && signupStep.value === 'otp') {
    // Signup OTP step
    setFieldValidation('signup_otp', [
      validationRules.required('Code is required'),
      validationRules.pattern(/^\d{6}$/, 'Enter the 6-digit code'),
    ])
    setFieldValidation('otp', [])
    setFieldValidation('new_password', [])
    setFieldValidation('confirm_password', [])
  } else if (isSignUp.value) {
    // Signup form step
    setFieldValidation('password', [
      validationRules.required('Password is required'),
      validationRules.strongPassword(),
    ])

    setFieldValidation('given_name', [
      validationRules.required('First name is required'),
      validationRules.name(),
    ])

    setFieldValidation('family_name', [
      validationRules.required('Last name is required'),
      validationRules.name(),
    ])
    setFieldValidation('signup_otp', [])
    setFieldValidation('otp', [])
    setFieldValidation('new_password', [])
    setFieldValidation('confirm_password', [])
  } else {
    // Ensure signup-only fields are not validated in sign-in mode
    removeFieldValidation('given_name')
    removeFieldValidation('family_name')
    setFieldValidation('signup_otp', [])
    setFieldValidation('otp', [])
    setFieldValidation('new_password', [])
    setFieldValidation('confirm_password', [])

    setFieldValidation('password', [
      validationRules.required('Password is required'),
      validationRules.minLength(1, 'Password is required'),
    ])
  }
}

watch(
  [isSignUp, resetStep, signupStep],
  () => {
    clearValidation()
    setupValidation()
  },
  { immediate: true },
)

// Keep confirm password rule in sync with new_password
watch(
  () => formData.new_password,
  () => {
    if (resetStep.value === 'confirm') {
      setFieldValidation('confirm_password', [
        validationRules.confirmPassword(formData.new_password, 'Passwords must match'),
      ])
      // re-validate confirm password if already touched
      validateFieldByName('confirm_password')
    }
  },
)

onMounted(() => {
  if (app.isAuthenticated && !props.isModal) {
    router.push('/dashboard')
  }
  setupValidation()
})

// Smoothly focus the new password field once OTP completes
watch(
  () => otpComplete.value,
  async (complete) => {
    if (complete && resetStep.value === 'confirm') {
      await nextTick()
      const input = document.querySelector('.new-password-fields input') as HTMLInputElement | null
      input?.focus()
    }
  },
)

function toggleMode() {
  if (resetStep.value !== 'none') {
    // ignore toggle when in reset flow
    return
  }
  isSignUp.value = !isSignUp.value
  signupStep.value = 'form'
  app.error = null
  notice.value = ''
  clearValidation()

  // Reset optional fields when switching modes
  if (!isSignUp.value) {
    formData.given_name = ''
    formData.family_name = ''
    formData.signup_otp = ''
    signupOtpDigits.value = ['', '', '', '', '', '']
    // Also remove their validations immediately to avoid accidental checks
    removeFieldValidation('given_name')
    removeFieldValidation('family_name')
    removeFieldValidation('signup_otp')
  }
}

async function handleSubmit() {
  app.error = null
  notice.value = ''
  if (!validateAllFields()) return

  if (resetStep.value === 'request') {
    await handleRequestReset()
    return
  }
  if (resetStep.value === 'confirm') {
    // Ensure OTP is completed before proceeding to password entry
    if (!otpComplete.value) {
      validateFieldByName('otp')
      return
    }
    await handleConfirmReset()
    return
  }

  // Handle signup flow
  if (isSignUp.value) {
    if (signupStep.value === 'form') {
      // Request OTP
      await handleRequestSignupOtp()
      return
    } else {
      // signupStep.value === 'otp'
      if (!signupOtpComplete.value) {
        validateFieldByName('signup_otp')
        return
      }
      await handleSignupWithOtp()
      return
    }
  }

  // Handle regular login
  const result = await app.login({
    email: formData.email,
    password: formData.password,
  })

  if (result.success) {
    if (props.isModal) {
      emit('authSuccess')
    } else {
      router.push('/dashboard')
    }
  }
}

function startReset() {
  isSignUp.value = false
  resetStep.value = 'request'
  app.error = null
  notice.value = ''
  clearValidation()
  setupValidation()
}

function cancelReset() {
  resetStep.value = 'none'
  app.error = null
  notice.value = ''
  formData.otp = ''
  otpDigits.value = ['', '', '', '', '', '']
  clearValidation()
  setupValidation()
}

function backToRequest() {
  resetStep.value = 'request'
  app.error = null
  notice.value = ''
  formData.otp = ''
  otpDigits.value = ['', '', '', '', '', '']
  clearValidation()
  setupValidation()
}

async function handleRequestReset() {
  try {
    app.setLoading(true)
    await authAPI.requestResetPassword({ email: formData.email })
    notice.value =
      'If an account exists for this email, a 6-digit code has been sent. It expires in 15 minutes. Please check your inbox (and spam folder).'
    resetStep.value = 'confirm'
    // prepare OTP inputs
    otpDigits.value = ['', '', '', '', '', '']
    clearValidation()
    setupValidation()
    await nextTick()
    // autofocus first OTP box
    otpRefs[0].value?.focus()
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { message?: string; error?: string } } }).response?.data
        ?.message ||
      (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
      'Failed to request password reset'
    app.setError(msg)
  } finally {
    app.setLoading(false)
  }
}

async function handleConfirmReset() {
  try {
    app.setLoading(true)
    await authAPI.resetPassword({
      email: formData.email,
      newPassword: formData.new_password,
      otp: formData.otp,
    })
    // Attempt auto-login with the new password
    const loginResult = await app.login({
      email: formData.email,
      password: formData.new_password,
    })
    if (loginResult.success) {
      // Clear sensitive fields
      formData.otp = ''
      formData.new_password = ''
      formData.confirm_password = ''
      resetStep.value = 'none'
      isSignUp.value = false
      clearValidation()
      setupValidation()
      otpDigits.value = ['', '', '', '', '', '']
      // Navigate or emit success depending on context
      if (props.isModal) {
        emit('authSuccess')
      } else {
        router.push('/dashboard')
      }
      return
    }
    // If auto-login fails, fall back to manual sign in
    notice.value = 'Password reset successful. Please sign in with your new password.'
    resetStep.value = 'none'
    isSignUp.value = false
    formData.password = ''
    clearValidation()
    setupValidation()
    otpDigits.value = ['', '', '', '', '', '']
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { message?: string; error?: string } } }).response?.data
        ?.message ||
      (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
      'Failed to reset password'
    app.setError(msg)
  } finally {
    app.setLoading(false)
  }
}

function onOtpInput(index: number, evt: InputEvent) {
  const target = evt.target as HTMLInputElement
  const val = target.value.replace(/\D/g, '')
  if (!val) {
    otpDigits.value[index] = ''
    return
  }
  otpDigits.value[index] = val[val.length - 1]
  // Move to next input if exists
  if (index < otpRefs.length - 1) {
    otpRefs[index + 1].value?.focus()
    otpRefs[index + 1].value?.select()
  } else {
    // blur last to hint completion
    otpRefs[index].value?.blur()
  }
}

function onOtpKeydown(index: number, evt: KeyboardEvent) {
  if (evt.key === 'Backspace') {
    if (otpDigits.value[index]) {
      otpDigits.value[index] = ''
      return
    }
    if (index > 0) {
      otpRefs[index - 1].value?.focus()
      otpRefs[index - 1].value?.select()
      otpDigits.value[index - 1] = ''
    }
  }
  if (evt.key === 'ArrowLeft' && index > 0) {
    otpRefs[index - 1].value?.focus()
    otpRefs[index - 1].value?.select()
    evt.preventDefault()
  }
  if (evt.key === 'ArrowRight' && index < otpRefs.length - 1) {
    otpRefs[index + 1].value?.focus()
    otpRefs[index + 1].value?.select()
    evt.preventDefault()
  }
  // prevent non-digit input via keyboard
  if (evt.key.length === 1 && /\D/.test(evt.key)) {
    evt.preventDefault()
  }
}

function onOtpPaste(evt: ClipboardEvent) {
  const text = evt.clipboardData?.getData('text') || ''
  const digits = text.replace(/\D/g, '').slice(0, 6).split('')
  if (digits.length === 0) return
  evt.preventDefault()
  for (let i = 0; i < 6; i++) {
    otpDigits.value[i] = digits[i] || ''
  }
  // focus next empty or blur last
  const nextIndex = otpDigits.value.findIndex((d) => !d)
  if (nextIndex === -1) {
    otpRefs[5].value?.blur()
  } else {
    otpRefs[nextIndex].value?.focus()
    otpRefs[nextIndex].value?.select()
  }
}

// Signup OTP handlers
function onSignupOtpInput(index: number, evt: InputEvent) {
  const target = evt.target as HTMLInputElement
  const val = target.value.replace(/\D/g, '')
  if (!val) {
    signupOtpDigits.value[index] = ''
    return
  }
  signupOtpDigits.value[index] = val[val.length - 1]
  // Move to next input if exists
  if (index < signupOtpRefs.length - 1) {
    signupOtpRefs[index + 1].value?.focus()
    signupOtpRefs[index + 1].value?.select()
  } else {
    // blur last to hint completion
    signupOtpRefs[index].value?.blur()
  }
}

function onSignupOtpKeydown(index: number, evt: KeyboardEvent) {
  if (evt.key === 'Backspace') {
    if (signupOtpDigits.value[index]) {
      signupOtpDigits.value[index] = ''
      return
    }
    if (index > 0) {
      signupOtpRefs[index - 1].value?.focus()
      signupOtpRefs[index - 1].value?.select()
      signupOtpDigits.value[index - 1] = ''
    }
  }
  if (evt.key === 'ArrowLeft' && index > 0) {
    signupOtpRefs[index - 1].value?.focus()
    signupOtpRefs[index - 1].value?.select()
    evt.preventDefault()
  }
  if (evt.key === 'ArrowRight' && index < signupOtpRefs.length - 1) {
    signupOtpRefs[index + 1].value?.focus()
    signupOtpRefs[index + 1].value?.select()
    evt.preventDefault()
  }
  // prevent non-digit input via keyboard
  if (evt.key.length === 1 && /\D/.test(evt.key)) {
    evt.preventDefault()
  }
}

function onSignupOtpPaste(evt: ClipboardEvent) {
  const text = evt.clipboardData?.getData('text') || ''
  const digits = text.replace(/\D/g, '').slice(0, 6).split('')
  if (digits.length === 0) return
  evt.preventDefault()
  for (let i = 0; i < 6; i++) {
    signupOtpDigits.value[i] = digits[i] || ''
  }
  // focus next empty or blur last
  const nextIndex = signupOtpDigits.value.findIndex((d) => !d)
  if (nextIndex === -1) {
    signupOtpRefs[5].value?.blur()
  } else {
    signupOtpRefs[nextIndex].value?.focus()
    signupOtpRefs[nextIndex].value?.select()
  }
}

async function handleRequestSignupOtp() {
  const result = await app.requestRegisterOtp(formData.email)
  if (result.success) {
    notice.value =
      'A 6-digit code has been sent to your email. It expires in 15 minutes. If you do not see it, please check your spam folder.'
    signupStep.value = 'otp'
    // prepare OTP inputs
    signupOtpDigits.value = ['', '', '', '', '', '']
    clearValidation()
    setupValidation()
    await nextTick()
    // autofocus first OTP box
    signupOtpRefs[0].value?.focus()
  }
}

async function handleSignupWithOtp() {
  const result = await app.register({
    email: formData.email,
    password: formData.password,
    given_name: formData.given_name,
    family_name: formData.family_name,
    code: formData.signup_otp,
  })

  if (result.success) {
    // Clear sensitive fields
    formData.signup_otp = ''
    signupOtpDigits.value = ['', '', '', '', '', '']
    signupStep.value = 'form'
    clearValidation()
    setupValidation()
    // Navigate or emit success depending on context
    if (props.isModal) {
      emit('authSuccess')
    } else {
      router.push('/dashboard')
    }
  } else if (result.error?.includes('User already has a Cognito ID and it cannot be updated')) {
    // User has an OAuth account, redirect to sign in
    app.setError(
      'This email is already registered with Google or Apple. Please sign in using the OAuth button below.',
    )
    // Clear signup form and switch to sign in
    formData.signup_otp = ''
    signupOtpDigits.value = ['', '', '', '', '', '']
    signupStep.value = 'form'
    isSignUp.value = false
    clearValidation()
    setupValidation()
  }
}

function backToSignupForm() {
  signupStep.value = 'form'
  app.error = null
  notice.value = ''
  formData.signup_otp = ''
  signupOtpDigits.value = ['', '', '', '', '', '']
  clearValidation()
  setupValidation()
}

async function handleGoogleSignIn() {
  try {
    // Store current page before redirecting to OAuth
    localStorage.setItem('last_viewed_page', route.fullPath)
    await redirectToGoogleAuth()
  } catch (error) {
    console.error('Failed to initiate Google sign in:', error)
    app.setError('Failed to initiate Google sign in. Please try again.')
  }
}

async function handleAppleSignIn() {
  try {
    // Store current page before redirecting to OAuth
    localStorage.setItem('last_viewed_page', route.fullPath)
    await redirectToAppleAuth()
  } catch (error) {
    console.error('Failed to initiate Apple sign in:', error)
    app.setError('Failed to initiate Apple sign in. Please try again.')
  }
}

function goToMarketplace() {
  router.push('/')
}
</script>
<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  position: relative;
}

.auth-page--modal {
  min-height: auto;
  padding: 0;
  background: transparent;
  position: static;
  display: block;
}

.auth-header-left {
  position: absolute;
  top: var(--space-10);
  left: var(--space-4);
  z-index: var(--z-dropdown);
}

.auth-header-controls {
  position: absolute;
  top: var(--space-10);
  right: var(--space-4);
  z-index: var(--z-dropdown);
}

.auth-card {
  width: 100%;
  max-width: var(--size-md);
  animation: slideUp 0.3s ease-out;
}

.auth-card--modal {
  max-width: 100%;
  animation: none;
}

.auth-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.auth-header--modal {
  margin-bottom: var(--space-4);
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.back-button svg {
  flex-shrink: 0;
}

.auth-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.auth-subtitle {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.auth-form--modal {
  gap: var(--space-4);
}

.form-actions {
  margin-top: var(--space-2);
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: calc(var(--space-2) * -1);
}

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
}

.toggle-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-logo {
  position: relative;
  transition: all 0.3s ease;
}

/* Light mode - show full color SVG */
.auth-logo[src] {
  opacity: 1;
  position: relative;
  z-index: 1;
}

.reset-pw {
  margin: auto;
}

/* Transition for revealing new password fields */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.otp-label {
  display: block;
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-2);
}

.otp-inputs {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

.otp-input {
  width: 44px;
  height: 52px;
  text-align: center;
  font-size: var(--font-size-xl);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.otp-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 25%, transparent);
}

.otp-error {
  margin-top: var(--space-1);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

[data-theme='dark'] .auth-header {
  filter: brightness(0) saturate(100%) invert(98%) sepia(4%) saturate(346%) hue-rotate(183deg)
    brightness(106%) contrast(93%);
}

/* Responsive design */
@media (max-width: 640px) {
  .auth-page {
    padding: var(--space-2);
    align-items: flex-start;
    padding-top: var(--space-8);
  }

  .auth-card {
    max-width: 100%;
  }

  .auth-title {
    font-size: var(--font-size-xl);
  }
}
.pb-md {
  padding-bottom: var(--space-4);
}

.oauth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: var(--space-2) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.oauth-divider::before,
.oauth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-border);
}

.oauth-divider span {
  padding: 0 var(--space-3);
}

.oauth-icon {
  width: 18px;
  height: 18px;
  margin-right: var(--space-2);
  vertical-align: middle;
  display: inline-block;
}

.apple-logo path {
  fill: #0b0b0a;
}

[data-theme='dark'] .apple-logo path {
  fill: #8e8e93;
}

.button-row {
  display: flex;
  gap: var(--space-3);
  width: 100%;
}

.button-row > * {
  flex: 1;
}
</style>
