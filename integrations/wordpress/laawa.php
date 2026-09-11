<?php
/**
 * Plugin Name: LaaWa Connector
 * Description: Adds a secure WordPress REST bridge to a self-hosted LaaWa instance.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) exit;

final class LaaWa_Connector {
  const OPTION = 'laawa_connector_settings';
  public static function init() {
    add_action('admin_menu', [__CLASS__, 'menu']);
    add_action('admin_init', [__CLASS__, 'settings']);
    add_action('rest_api_init', [__CLASS__, 'rest']);
  }
  public static function menu() { add_options_page('LaaWa Connector', 'LaaWa', 'manage_options', 'laawa-connector', [__CLASS__, 'page']); }
  public static function settings() {
    register_setting('laawa_connector', self::OPTION, ['sanitize_callback' => [__CLASS__, 'sanitize']]);
    add_settings_section('laawa_main', 'Connection', '__return_false', 'laawa-connector');
    foreach (['base_url'=>'LaaWa API URL','api_key'=>'LaaWa API key','account_id'=>'WhatsApp account ID'] as $key=>$label) add_settings_field($key, $label, function() use($key){ $s=get_option(self::OPTION,[]); printf('<input class="regular-text" name="%s[%s]" value="%s" type="%s">', esc_attr(self::OPTION), esc_attr($key), esc_attr($s[$key]??''), $key==='api_key'?'password':'url'); }, 'laawa-connector','laawa_main');
  }
  public static function sanitize($input) { return ['base_url'=>esc_url_raw(rtrim($input['base_url']??'','/')), 'api_key'=>sanitize_text_field($input['api_key']??''), 'account_id'=>sanitize_text_field($input['account_id']??'')]; }
  public static function page() { if (!current_user_can('manage_options')) return; echo '<div class="wrap"><h1>LaaWa Connector</h1><form method="post" action="options.php">'; settings_fields('laawa_connector'); do_settings_sections('laawa-connector'); submit_button('Save connection'); echo '</form></div>'; }
  public static function rest() { register_rest_route('laawa/v1','/send', ['methods'=>'POST','permission_callback'=>function(){return current_user_can('edit_posts');},'callback'=>[__CLASS__,'send']]); }
  public static function send($request) { $s=get_option(self::OPTION,[]); if(empty($s['base_url'])||empty($s['api_key'])||empty($s['account_id'])) return new WP_Error('laawa_not_configured','Configure the LaaWa connector first.', ['status'=>409]); $chat=sanitize_text_field($request->get_param('chat_id')); $text=sanitize_textarea_field($request->get_param('text')); if(!$chat||!$text) return new WP_Error('laawa_invalid','chat_id and text are required.', ['status'=>400]); $r=wp_remote_post($s['base_url'].'/messages',['timeout'=>20,'headers'=>['Authorization'=>'Bearer '.$s['api_key'],'Content-Type'=>'application/json'],'body'=>wp_json_encode(['accountId'=>$s['account_id'],'chatId'=>$chat,'text'=>$text])]); if(is_wp_error($r)) return $r; $code=wp_remote_retrieve_response_code($r); $body=json_decode(wp_remote_retrieve_body($r),true); if($code>=300) return new WP_Error('laawa_api','LaaWa rejected the message.',['status'=>502,'upstream'=>$body]); return rest_ensure_response($body);
  }
}
LaaWa_Connector::init();
