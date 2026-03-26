<?php
/**
 * Plugin Name: Witylogix Delivery Scheduler
 * Plugin URI: https://witylogix.com
 * Description: WooCommerce checkout block for delivery date, time slot, and address-based rate selection
 * Version: 1.0.0
 * Author: Witylogix
 * Author URI: https://witylogix.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: witylogix-delivery
 * Domain Path: /languages
 * Requires at least: 5.9
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
  exit;
}

/**
 * Plugin constants
 */
define( 'WITYLOGIX_DELIVERY_PLUGIN_FILE', __FILE__ );
define( 'WITYLOGIX_DELIVERY_PLUGIN_DIR', dirname( WITYLOGIX_DELIVERY_PLUGIN_FILE ) );
define( 'WITYLOGIX_DELIVERY_PLUGIN_URL', plugins_url( '', WITYLOGIX_DELIVERY_PLUGIN_FILE ) );
define( 'WITYLOGIX_DELIVERY_PLUGIN_VERSION', '1.0.0' );

/**
 * Initialize plugin
 */
function witylogix_delivery_init() {
  // Register block type
  witylogix_delivery_register_block();

  // Register REST API endpoints
  witylogix_delivery_register_rest_routes();

  // Register hooks
  add_action( 'woocommerce_checkout_order_processed', 'witylogix_delivery_save_order_meta', 10, 1 );
  add_action( 'woocommerce_admin_order_data_after_shipping_address', 'witylogix_delivery_display_order_meta', 10, 1 );
  add_filter( 'woocommerce_order_data_store_cpt_args', 'witylogix_delivery_order_post_type_args', 10, 2 );
}
add_action( 'plugins_loaded', 'witylogix_delivery_init', 20 );

/**
 * Register Gutenberg block type
 */
function witylogix_delivery_register_block() {
  $block_json_path = WITYLOGIX_DELIVERY_PLUGIN_DIR . '/block.json';

  if ( file_exists( $block_json_path ) ) {
    register_block_type( $block_json_path );

    // Enqueue scripts and styles
    wp_enqueue_script(
      'witylogix-delivery-block',
      WITYLOGIX_DELIVERY_PLUGIN_URL . '/build/index.js',
      array( 'wp-blocks', 'wp-components', 'wp-element', 'wp-i18n' ),
      WITYLOGIX_DELIVERY_PLUGIN_VERSION,
      true
    );

    wp_enqueue_style(
      'witylogix-delivery-block',
      WITYLOGIX_DELIVERY_PLUGIN_URL . '/src/styles/block.css',
      array(),
      WITYLOGIX_DELIVERY_PLUGIN_VERSION
    );

    // Pass nonce to frontend
    wp_localize_script(
      'witylogix-delivery-block',
      'witylogixDeliveryData',
      array(
        'nonce' => wp_create_nonce( 'wc_store_api' ),
        'apiUrl' => get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' ),
        'merchantId' => get_option( 'witylogix_delivery_merchant_id', '' ),
      )
    );
  }
}

/**
 * Register REST API routes
 */
function witylogix_delivery_register_rest_routes() {
  register_rest_route(
    'wc/v1/witylogix',
    '/slots',
    array(
      'methods' => 'GET',
      'callback' => 'witylogix_delivery_get_slots',
      'permission_callback' => '__return_true',
      'args' => array(
        'date' => array(
          'type' => 'string',
          'pattern' => '^\d{4}-\d{2}-\d{2}$',
          'required' => true,
        ),
        'zone_id' => array(
          'type' => 'string',
          'required' => false,
        ),
      ),
    )
  );

  register_rest_route(
    'wc/v1/witylogix',
    '/rates',
    array(
      'methods' => 'GET',
      'callback' => 'witylogix_delivery_get_rates',
      'permission_callback' => '__return_true',
      'args' => array(
        'zip' => array(
          'type' => 'string',
          'required' => true,
        ),
        'country' => array(
          'type' => 'string',
          'default' => 'US',
        ),
      ),
    )
  );

  register_rest_route(
    'wc/v1/witylogix',
    '/reserve',
    array(
      'methods' => 'POST',
      'callback' => 'witylogix_delivery_reserve_slot',
      'permission_callback' => '__return_true',
      'args' => array(
        'slotId' => array(
          'type' => 'string',
          'required' => true,
        ),
        'orderId' => array(
          'type' => 'string',
          'required' => true,
        ),
      ),
    )
  );

  register_rest_route(
    'wc/v1/witylogix',
    '/validate-address',
    array(
      'methods' => 'POST',
      'callback' => 'witylogix_delivery_validate_address',
      'permission_callback' => '__return_true',
      'args' => array(
        'street' => array( 'type' => 'string' ),
        'city' => array( 'type' => 'string' ),
        'state' => array( 'type' => 'string' ),
        'zipcode' => array( 'type' => 'string' ),
        'country' => array( 'type' => 'string' ),
      ),
    )
  );

  register_rest_route(
    'wc/v1/witylogix',
    '/availability',
    array(
      'methods' => 'GET',
      'callback' => 'witylogix_delivery_check_availability',
      'permission_callback' => '__return_true',
      'args' => array(
        'zip' => array(
          'type' => 'string',
          'required' => true,
        ),
        'country' => array(
          'type' => 'string',
          'default' => 'US',
        ),
      ),
    )
  );
}

/**
 * Get available delivery slots
 */
function witylogix_delivery_get_slots( WP_REST_Request $request ) {
  $date = $request->get_param( 'date' );
  $zone_id = $request->get_param( 'zone_id' );

  // Proxy to Witylogix API
  $api_url = get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' );
  $merchant_id = get_option( 'witylogix_delivery_merchant_id', '' );
  $api_key = get_option( 'witylogix_delivery_api_key', '' );

  if ( ! $merchant_id || ! $api_key ) {
    return new WP_REST_Response(
      array( 'error' => 'Witylogix API not configured' ),
      400
    );
  }

  $endpoint = "{$api_url}/api/checkout/slots";
  $args = array(
    'method' => 'GET',
    'headers' => array(
      'Content-Type' => 'application/json',
      'X-API-Key' => $api_key,
      'X-Merchant-ID' => $merchant_id,
    ),
  );

  $query_params = array( 'date' => $date );
  if ( $zone_id ) {
    $query_params['zone_id'] = $zone_id;
  }

  $response = wp_remote_get( add_query_arg( $query_params, $endpoint ), $args );

  if ( is_wp_error( $response ) ) {
    return new WP_REST_Response(
      array( 'error' => $response->get_error_message() ),
      500
    );
  }

  $body = json_decode( wp_remote_retrieve_body( $response ), true );
  $status = wp_remote_retrieve_response_code( $response );

  return new WP_REST_Response( $body, $status );
}

/**
 * Get delivery rates for zone
 */
function witylogix_delivery_get_rates( WP_REST_Request $request ) {
  $zipcode = $request->get_param( 'zip' );
  $country = $request->get_param( 'country' );

  $api_url = get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' );
  $merchant_id = get_option( 'witylogix_delivery_merchant_id', '' );
  $api_key = get_option( 'witylogix_delivery_api_key', '' );

  if ( ! $merchant_id || ! $api_key ) {
    return new WP_REST_Response(
      array( 'error' => 'Witylogix API not configured' ),
      400
    );
  }

  $endpoint = "{$api_url}/api/checkout/rates";
  $args = array(
    'method' => 'GET',
    'headers' => array(
      'Content-Type' => 'application/json',
      'X-API-Key' => $api_key,
      'X-Merchant-ID' => $merchant_id,
    ),
  );

  $query_params = array(
    'zip' => $zipcode,
    'country' => $country,
  );

  $response = wp_remote_get( add_query_arg( $query_params, $endpoint ), $args );

  if ( is_wp_error( $response ) ) {
    return new WP_REST_Response(
      array( 'error' => $response->get_error_message() ),
      500
    );
  }

  $body = json_decode( wp_remote_retrieve_body( $response ), true );
  $status = wp_remote_retrieve_response_code( $response );

  return new WP_REST_Response( $body, $status );
}

/**
 * Reserve a delivery slot
 */
function witylogix_delivery_reserve_slot( WP_REST_Request $request ) {
  $slot_id = $request->get_param( 'slotId' );
  $order_id = $request->get_param( 'orderId' );

  $api_url = get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' );
  $merchant_id = get_option( 'witylogix_delivery_merchant_id', '' );
  $api_key = get_option( 'witylogix_delivery_api_key', '' );

  if ( ! $merchant_id || ! $api_key ) {
    return new WP_REST_Response(
      array( 'error' => 'Witylogix API not configured' ),
      400
    );
  }

  $endpoint = "{$api_url}/api/checkout/reserve";
  $body = json_encode(
    array(
      'slotId' => $slot_id,
      'orderId' => $order_id,
    )
  );

  $args = array(
    'method' => 'POST',
    'headers' => array(
      'Content-Type' => 'application/json',
      'X-API-Key' => $api_key,
      'X-Merchant-ID' => $merchant_id,
    ),
    'body' => $body,
  );

  $response = wp_remote_post( $endpoint, $args );

  if ( is_wp_error( $response ) ) {
    return new WP_REST_Response(
      array( 'error' => $response->get_error_message() ),
      500
    );
  }

  $body = json_decode( wp_remote_retrieve_body( $response ), true );
  $status = wp_remote_retrieve_response_code( $response );

  return new WP_REST_Response( $body, $status );
}

/**
 * Validate shipping address
 */
function witylogix_delivery_validate_address( WP_REST_Request $request ) {
  $address = array(
    'street' => $request->get_param( 'street' ),
    'city' => $request->get_param( 'city' ),
    'state' => $request->get_param( 'state' ),
    'zipcode' => $request->get_param( 'zipcode' ),
    'country' => $request->get_param( 'country' ),
  );

  $api_url = get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' );
  $merchant_id = get_option( 'witylogix_delivery_merchant_id', '' );
  $api_key = get_option( 'witylogix_delivery_api_key', '' );

  if ( ! $merchant_id || ! $api_key ) {
    return new WP_REST_Response(
      array( 'error' => 'Witylogix API not configured' ),
      400
    );
  }

  $endpoint = "{$api_url}/api/checkout/validate-address";
  $body = json_encode( $address );

  $args = array(
    'method' => 'POST',
    'headers' => array(
      'Content-Type' => 'application/json',
      'X-API-Key' => $api_key,
      'X-Merchant-ID' => $merchant_id,
    ),
    'body' => $body,
  );

  $response = wp_remote_post( $endpoint, $args );

  if ( is_wp_error( $response ) ) {
    return new WP_REST_Response(
      array( 'error' => $response->get_error_message() ),
      500
    );
  }

  $body = json_decode( wp_remote_retrieve_body( $response ), true );
  $status = wp_remote_retrieve_response_code( $response );

  return new WP_REST_Response( $body, $status );
}

/**
 * Check service availability for zipcode
 */
function witylogix_delivery_check_availability( WP_REST_Request $request ) {
  $zipcode = $request->get_param( 'zip' );
  $country = $request->get_param( 'country' );

  $api_url = get_option( 'witylogix_delivery_api_url', 'https://api.witylogix.app' );
  $merchant_id = get_option( 'witylogix_delivery_merchant_id', '' );
  $api_key = get_option( 'witylogix_delivery_api_key', '' );

  if ( ! $merchant_id || ! $api_key ) {
    return new WP_REST_Response(
      array( 'error' => 'Witylogix API not configured' ),
      400
    );
  }

  $endpoint = "{$api_url}/api/checkout/availability";
  $args = array(
    'method' => 'GET',
    'headers' => array(
      'Content-Type' => 'application/json',
      'X-API-Key' => $api_key,
      'X-Merchant-ID' => $merchant_id,
    ),
  );

  $query_params = array(
    'zip' => $zipcode,
    'country' => $country,
  );

  $response = wp_remote_get( add_query_arg( $query_params, $endpoint ), $args );

  if ( is_wp_error( $response ) ) {
    return new WP_REST_Response(
      array( 'error' => $response->get_error_message() ),
      500
    );
  }

  $body = json_decode( wp_remote_retrieve_body( $response ), true );
  $status = wp_remote_retrieve_response_code( $response );

  return new WP_REST_Response( $body, $status );
}

/**
 * Save delivery selection to order meta
 */
function witylogix_delivery_save_order_meta( int $order_id ) {
  if ( isset( $_POST['witylogix_delivery_date'] ) ) {
    update_post_meta(
      $order_id,
      '_witylogix_delivery_date',
      sanitize_text_field( $_POST['witylogix_delivery_date'] )
    );
  }

  if ( isset( $_POST['witylogix_delivery_slot'] ) ) {
    update_post_meta(
      $order_id,
      '_witylogix_delivery_slot',
      sanitize_text_field( $_POST['witylogix_delivery_slot'] )
    );
  }

  if ( isset( $_POST['witylogix_delivery_notes'] ) ) {
    update_post_meta(
      $order_id,
      '_witylogix_delivery_notes',
      sanitize_textarea_field( $_POST['witylogix_delivery_notes'] )
    );
  }
}

/**
 * Display delivery info in admin order detail
 */
function witylogix_delivery_display_order_meta( WC_Order $order ) {
  $delivery_date = $order->get_meta( '_witylogix_delivery_date' );
  $delivery_slot = $order->get_meta( '_witylogix_delivery_slot' );
  $delivery_notes = $order->get_meta( '_witylogix_delivery_notes' );

  if ( ! $delivery_date && ! $delivery_slot && ! $delivery_notes ) {
    return;
  }

  echo '<h3>' . esc_html__( 'Witylogix Delivery Information', 'witylogix-delivery' ) . '</h3>';
  echo '<div class="witylogix-delivery-info">';

  if ( $delivery_date ) {
    echo '<p><strong>' . esc_html__( 'Delivery Date:', 'witylogix-delivery' ) . '</strong> ';
    echo esc_html( wp_date( 'F d, Y', strtotime( $delivery_date ) ) ) . '</p>';
  }

  if ( $delivery_slot ) {
    echo '<p><strong>' . esc_html__( 'Time Slot:', 'witylogix-delivery' ) . '</strong> ';
    echo esc_html( $delivery_slot ) . '</p>';
  }

  if ( $delivery_notes ) {
    echo '<p><strong>' . esc_html__( 'Delivery Notes:', 'witylogix-delivery' ) . '</strong><br />';
    echo '<textarea readonly rows="3" style="width: 100%;">' . esc_textarea( $delivery_notes ) . '</textarea></p>';
  }

  echo '</div>';
}

/**
 * Add custom post type args for orders
 */
function witylogix_delivery_order_post_type_args( array $args, WC_Order $order ): array {
  if ( $order->get_meta( '_witylogix_delivery_date' ) ) {
    $args['show_in_rest'] = true;
  }

  return $args;
}
